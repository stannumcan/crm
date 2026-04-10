import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateWilfredCost } from "@/lib/calculations";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const {
    cost_sheet_id,
    tiers, // array of { tier_label, quantity, total_subtotal, labor_cost, accessories_cost, overhead_multiplier, margin_rate }
  } = body;

  const records = tiers.map((t: {
    tier_label: string;
    quantity: number;
    total_subtotal: number;
    labor_cost: number;
    accessories_cost: number;
    overhead_multiplier?: number;
    margin_rate?: number;
  }) => ({
    cost_sheet_id,
    tier_label: t.tier_label,
    quantity: t.quantity,
    total_subtotal: t.total_subtotal,
    labor_cost: t.labor_cost,
    accessories_cost: t.accessories_cost,
    overhead_multiplier: t.overhead_multiplier ?? 1.0,
    margin_rate: t.margin_rate ?? 0.2,
    estimated_cost_rmb: calculateWilfredCost({
      totalSubtotal: t.total_subtotal,
      laborCost: t.labor_cost,
      accessoriesCost: t.accessories_cost,
      overheadMultiplier: t.overhead_multiplier ?? 1.0,
      marginRate: t.margin_rate ?? 0.2,
    }),
    approved: false,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("wilfred_calculations")
    .upsert(records, { onConflict: "cost_sheet_id,tier_label" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, approved, wilfred_notes, margin_rate, overhead_multiplier,
          total_subtotal, labor_cost, accessories_cost } = body;

  const estimated_cost_rmb = calculateWilfredCost({
    totalSubtotal: total_subtotal,
    laborCost: labor_cost,
    accessoriesCost: accessories_cost,
    overheadMultiplier: overhead_multiplier ?? 1.0,
    marginRate: margin_rate ?? 0.2,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("wilfred_calculations")
    .update({
      approved,
      approved_at: approved ? new Date().toISOString() : null,
      wilfred_notes,
      margin_rate,
      overhead_multiplier,
      estimated_cost_rmb,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If all tiers approved, update quotation status
  if (approved) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: calc } = await (supabase as any)
      .from("wilfred_calculations")
      .select("cost_sheet_id")
      .eq("id", id)
      .single();

    if (calc) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sheet } = await (supabase as any)
        .from("factory_cost_sheets")
        .select("quotation_id")
        .eq("id", calc.cost_sheet_id)
        .single();

      if (sheet) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("quotations")
          .update({ status: "pending_natsuki" })
          .eq("id", sheet.quotation_id);
      }
    }
  }

  return NextResponse.json(data);
}
