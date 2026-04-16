import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyWorkflowStep } from "@/lib/workflow-notify";
import { getNextVersion, supersedeCurrent, logChange } from "@/lib/versioning";
import { syncMilestonesFromQuote } from "@/lib/milestone-sync";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get upstream versions
  let basedOnDdpVersion = 1;
  let basedOnSheetVersion = 1;
  let cqRefNumber: string | null = null;
  let chainId: string | null = null;
  if (body.cost_sheet_id) {
    const { data: ddpRow } = await db
      .from("natsuki_ddp_calculations")
      .select("version")
      .eq("cost_sheet_id", body.cost_sheet_id)
      .eq("is_current", true)
      .limit(1)
      .single();
    basedOnDdpVersion = ddpRow?.version ?? 1;

    const { data: sheetRow } = await db
      .from("factory_cost_sheets")
      .select("version, ref_number")
      .eq("id", body.cost_sheet_id)
      .single();
    basedOnSheetVersion = sheetRow?.version ?? 1;
    if (sheetRow?.ref_number) {
      cqRefNumber = `${sheetRow.ref_number}/CQ`;
      chainId = cqRefNumber;
    }
  }

  // Use chain ID as the customer quote number (replacing legacy winhoop_quote_number)
  const insertBody = { ...body };
  if (chainId) insertBody.winhoop_quote_number = chainId;

  const { data, error } = await db
    .from("customer_quotes")
    .insert({
      ...insertBody,
      version: 1,
      is_current: true,
      based_on_ddp_version: basedOnDdpVersion,
      based_on_sheet_version: basedOnSheetVersion,
      ref_number: cqRefNumber,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logChange(supabase, "customer_quote", data.id, 1, "created", null, data);

  // Clear pricing_changed flag — the chain is complete
  await db.from("quotations").update({ status: "sent", pricing_changed: false }).eq("id", body.quotation_id);
  await notifyWorkflowStep(body.quotation_id, "sent");

  // Auto-mark WO milestones: "Customer Quote Sent"
  await syncMilestonesFromQuote(body.quotation_id).catch(console.error);

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, ...rest } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Fetch current version
  const { data: current } = await db
    .from("customer_quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newVersion = current.version + 1;

  // Supersede old version(s) for this cost_sheet + quotation
  const filters: Record<string, string> = { quotation_id: current.quotation_id };
  if (current.cost_sheet_id) filters.cost_sheet_id = current.cost_sheet_id;
  await supersedeCurrent(supabase, "customer_quotes", filters);

  // Insert new version
  const { id: _oldId, created_at: _ca, superseded_at: _sa, ...currentFields } = current;
  const { data: newCQ, error } = await db
    .from("customer_quotes")
    .insert({
      ...currentFields,
      ...rest,
      version: newVersion,
      is_current: true,
      superseded_at: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logChange(supabase, "customer_quote", newCQ.id, newVersion, "edited", null, newCQ);

  return NextResponse.json(newCQ);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("customer_quotes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
