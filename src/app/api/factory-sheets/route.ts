import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyWorkflowStep, notifyFactorySheet } from "@/lib/workflow-notify";
import { getNextVersion, supersedeCurrent, logChange } from "@/lib/versioning";
import { getNextChainLetter, buildFactorySheetRef, generateNewMoldNumber } from "@/lib/ref-numbers";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { tiers, ...sheetData } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get quote version + WO number for ref generation
  const { data: quotation } = await db
    .from("quotations")
    .select("quote_version, work_orders(wo_number)")
    .eq("id", sheetData.quotation_id)
    .single();

  // Generate NM placeholder if no mold number provided
  let moldNumber = sheetData.mold_number;
  if (!moldNumber) {
    moldNumber = await generateNewMoldNumber(supabase);
    sheetData.mold_number = moldNumber;
  }

  // Assign chain letter + ref number
  const chainLetter = await getNextChainLetter(supabase, sheetData.quotation_id, moldNumber);
  const woNumber = (quotation?.work_orders as { wo_number: string } | null)?.wo_number ?? "WO";
  const refNumber = buildFactorySheetRef(woNumber, moldNumber, chainLetter);

  const { data: sheet, error } = await db
    .from("factory_cost_sheets")
    .insert({
      ...sheetData,
      version: 1,
      is_current: true,
      based_on_quote_version: quotation?.quote_version ?? 1,
      chain_letter: chainLetter,
      ref_number: refNumber,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Set sheet_group_id to its own id (first version)
  await db.from("factory_cost_sheets").update({ sheet_group_id: sheet.id }).eq("id", sheet.id);

  if (tiers?.length) {
    const { error: tierErr } = await db.from("factory_cost_tiers").insert(
      tiers.map((t: object) => ({ ...t, cost_sheet_id: sheet.id }))
    );
    if (tierErr) {
      // Tier insert failing silently was the root cause of cost data showing as 0
      // after save. Surface any failure so the client can show a real error instead.
      console.error("[factory-sheets] tier insert failed:", tierErr);
      return NextResponse.json({ error: `Failed to save tier costs: ${tierErr.message}` }, { status: 500 });
    }
  }

  await logChange(supabase, "factory_cost_sheet", sheet.id, 1, "created", null, sheet);

  await db.from("quotations").update({ status: "pending_wilfred" }).eq("id", sheetData.quotation_id);
  await notifyFactorySheet(sheet.id, sheetData.quotation_id);

  return NextResponse.json(sheet, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, tiers, ...sheetData } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // If this is just a fee update (wilfred fees), do a simple update — no new version
  if (sheetData.wilfred_fees_approved !== undefined && !tiers) {
    const { data, error } = await db
      .from("factory_cost_sheets")
      .update(sheetData)
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Fetch the current sheet to get its version and group
  const { data: current } = await db
    .from("factory_cost_sheets")
    .select("*")
    .eq("id", id)
    .single();

  if (!current) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });

  const newVersion = current.version + 1;
  const sheetGroupId = current.sheet_group_id ?? current.id;

  // Supersede the current version
  await supersedeCurrent(supabase, "factory_cost_sheets", { sheet_group_id: sheetGroupId });

  // Insert new version (chain_letter persists across versions)
  const { id: _oldId, created_at: _ca, superseded_at: _sa, ...currentFields } = current;
  const mergedMold = sheetData.mold_number ?? current.mold_number;

  // Regenerate ref_number if mold changed
  let refNumber = current.ref_number;
  if (sheetData.mold_number && sheetData.mold_number !== current.mold_number) {
    const { data: q } = await db
      .from("quotations")
      .select("work_orders(wo_number)")
      .eq("id", current.quotation_id)
      .single();
    const woNumber = (q?.work_orders as { wo_number: string } | null)?.wo_number ?? "WO";
    refNumber = buildFactorySheetRef(woNumber, mergedMold, current.chain_letter ?? "A");
  }

  const { data: newSheet, error } = await db
    .from("factory_cost_sheets")
    .insert({
      ...currentFields,
      ...sheetData,
      version: newVersion,
      is_current: true,
      sheet_group_id: sheetGroupId,
      superseded_at: null,
      ref_number: refNumber,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert new tier rows
  if (tiers?.length) {
    const { error: tierErr } = await db.from("factory_cost_tiers").insert(
      tiers.map((t: object) => ({ ...t, cost_sheet_id: newSheet.id }))
    );
    if (tierErr) {
      console.error("[factory-sheets] tier insert failed on update:", tierErr);
      return NextResponse.json({ error: `Failed to save tier costs: ${tierErr.message}` }, { status: 500 });
    }
  }

  // Detect price changes — only flag if EXISTING price was changed, not initial entry
  let pricingChanged = false;
  // Helper: a price is "set" if it's not null/undefined
  const isSet = (v: unknown) => v !== null && v !== undefined && v !== "";
  // Helper: compare prices, returns true if old was set AND new differs
  const priceChanged = (oldVal: unknown, newVal: unknown) =>
    isSet(oldVal) && Number(oldVal) !== Number(newVal);

  if (tiers?.length) {
    const { data: oldTiers } = await db
      .from("factory_cost_tiers")
      .select("tier_label, total_subtotal, labor_cost, accessories_cost")
      .eq("cost_sheet_id", id);

    for (const newTier of tiers) {
      const oldTier = (oldTiers ?? []).find((o: { tier_label: string }) => o.tier_label === newTier.tier_label);
      if (!oldTier) continue; // new tier added — not a price change to existing
      if (priceChanged(oldTier.total_subtotal, newTier.total_subtotal)
        || priceChanged(oldTier.labor_cost, newTier.labor_cost)
        || priceChanged(oldTier.accessories_cost, newTier.accessories_cost)) {
        pricingChanged = true;
        break;
      }
    }
  }

  // Also check mold cost changes — only if OLD value was set
  if (!pricingChanged) {
    if (priceChanged(current.mold_cost_new, newSheet.mold_cost_new)
      || priceChanged(current.mold_cost_modify, newSheet.mold_cost_modify)) {
      pricingChanged = true;
    }
  }

  // Mark sheet as pricing_changed
  if (pricingChanged) {
    await db.from("factory_cost_sheets").update({ pricing_changed: true }).eq("id", newSheet.id);
  }

  await logChange(supabase, "factory_cost_sheet", newSheet.id, newVersion,
    pricingChanged ? "edited" : "edited", null, { ...newSheet, pricing_changed: pricingChanged });

  // Cascade invalidation: if pricing changed, revoke downstream approvals
  if (pricingChanged) {
    // Revoke wilfred calc approvals for the OLD sheet ID
    await db.from("wilfred_calculations")
      .update({ approved: false, approved_at: null })
      .eq("cost_sheet_id", id)
      .eq("is_current", true);

    // Revoke wilfred fees approval
    await db.from("factory_cost_sheets")
      .update({ wilfred_fees_approved: false })
      .eq("id", newSheet.id);

    // Supersede DDP calcs (they need to be recalculated)
    await db.from("natsuki_ddp_calculations")
      .update({ is_current: false, superseded_at: new Date().toISOString() })
      .eq("cost_sheet_id", id)
      .eq("is_current", true);

    // Supersede customer quotes
    await db.from("customer_quotes")
      .update({ is_current: false, superseded_at: new Date().toISOString() })
      .eq("cost_sheet_id", id)
      .eq("is_current", true);
  }

  // Update quotation status and notify
  if (newSheet.quotation_id) {
    await db.from("quotations").update({
      status: "pending_wilfred",
      pricing_changed: pricingChanged ? true : undefined,
    }).eq("id", newSheet.quotation_id);
    await notifyFactorySheet(newSheet.id, newSheet.quotation_id, pricingChanged);
  }

  return NextResponse.json({ ...newSheet, pricing_changed: pricingChanged });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("factory_cost_sheets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
