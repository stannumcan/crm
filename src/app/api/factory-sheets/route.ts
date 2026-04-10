import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { components, tiers, ...sheetData } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sheet, error } = await (supabase as any)
    .from("factory_cost_sheets")
    .insert(sheetData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert components (lid/body/bottom/inner)
  if (components?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("factory_cost_components").insert(
      components.map((c: object) => ({ ...c, cost_sheet_id: sheet.id }))
    );
  }

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

  return NextResponse.json(sheet, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, components, tiers, ...sheetData } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("factory_cost_sheets")
    .update(sheetData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
