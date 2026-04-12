import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyWorkflowStep, notifyFactorySheet } from "@/lib/workflow-notify";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { tiers, ...sheetData } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sheet, error } = await (supabase as any)
    .from("factory_cost_sheets")
    .insert(sheetData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert cost tiers
  if (tiers?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("factory_cost_tiers").insert(
      tiers.map((t: object) => ({ ...t, cost_sheet_id: sheet.id }))
    );
  }

  // Update quotation status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quotations")
    .update({ status: "pending_wilfred" })
    .eq("id", sheetData.quotation_id);

  await notifyFactorySheet(sheet.id, sheetData.quotation_id);

  return NextResponse.json(sheet, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, tiers, ...sheetData } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("factory_cost_sheets")
    .update(sheetData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Replace tiers: delete existing then re-insert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("factory_cost_tiers").delete().eq("cost_sheet_id", id);
  if (tiers?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("factory_cost_tiers").insert(
      tiers.map((t: object) => ({ ...t, cost_sheet_id: id }))
    );
  }

  // Update quotation status and send factory sheet–specific email
  if (data?.quotation_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("quotations")
      .update({ status: "pending_wilfred" })
      .eq("id", data.quotation_id);

    await notifyFactorySheet(id, data.quotation_id);
  }

  return NextResponse.json(data);
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
