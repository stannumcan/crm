import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyWorkflowStep, notifyFactorySheet } from "@/lib/workflow-notify";
import { getNextVersion, supersedeCurrent, logChange } from "@/lib/versioning";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { tiers, ...sheetData } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get quote version for linking
  const { data: quotation } = await db
    .from("quotations")
    .select("quote_version")
    .eq("id", sheetData.quotation_id)
    .single();

  const { data: sheet, error } = await db
    .from("factory_cost_sheets")
    .insert({
      ...sheetData,
      version: 1,
      is_current: true,
      based_on_quote_version: quotation?.quote_version ?? 1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Set sheet_group_id to its own id (first version)
  await db.from("factory_cost_sheets").update({ sheet_group_id: sheet.id }).eq("id", sheet.id);

  if (tiers?.length) {
    await db.from("factory_cost_tiers").insert(
      tiers.map((t: object) => ({ ...t, cost_sheet_id: sheet.id }))
    );
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

  // Insert new version
  const { id: _oldId, created_at: _ca, superseded_at: _sa, ...currentFields } = current;
  const { data: newSheet, error } = await db
    .from("factory_cost_sheets")
    .insert({
      ...currentFields,
      ...sheetData,
      version: newVersion,
      is_current: true,
      sheet_group_id: sheetGroupId,
      superseded_at: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert new tier rows
  if (tiers?.length) {
    await db.from("factory_cost_tiers").insert(
      tiers.map((t: object) => ({ ...t, cost_sheet_id: newSheet.id }))
    );
  }

  await logChange(supabase, "factory_cost_sheet", newSheet.id, newVersion, "edited", null, newSheet);

  // Update quotation status and notify
  if (newSheet.quotation_id) {
    await db.from("quotations").update({ status: "pending_wilfred" }).eq("id", newSheet.quotation_id);
    await notifyFactorySheet(newSheet.id, newSheet.quotation_id);
  }

  return NextResponse.json(newSheet);
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
