import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateWilfredCost } from "@/lib/calculations";
import { notifyWorkflowStep } from "@/lib/workflow-notify";
import { getNextVersion, supersedeCurrent, logChange } from "@/lib/versioning";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { cost_sheet_id, tiers } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get the factory sheet's current version + ref_number
  const { data: sheet } = await db
    .from("factory_cost_sheets")
    .select("version, ref_number")
    .eq("id", cost_sheet_id)
    .single();

  const basedOnSheetVersion = sheet?.version ?? 1;
  const ccRefNumber = sheet?.ref_number ? `${sheet.ref_number}/CC` : null;

  // Find next version for this cost_sheet_id
  const newVersion = await getNextVersion(supabase, "wilfred_calculations", { cost_sheet_id });

  // Supersede old rows (instead of deleting)
  if (newVersion > 1) {
    await supersedeCurrent(supabase, "wilfred_calculations", { cost_sheet_id });
  }

  const records = tiers.map((t: {
    tier_label: string; quantity: number; total_subtotal: number;
    labor_cost: number; accessories_cost: number;
    overhead_multiplier?: number; margin_rate?: number; wilfred_notes?: string;
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
    version: newVersion,
    is_current: true,
    based_on_sheet_version: basedOnSheetVersion,
    ref_number: ccRefNumber,
  }));

  const { data, error } = await db
    .from("wilfred_calculations")
    .insert(records)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log each row
  for (const row of data ?? []) {
    await logChange(supabase, "wilfred_calculation", row.id, newVersion, newVersion === 1 ? "created" : "edited", null, row);
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, approved, wilfred_notes, margin_rate, overhead_multiplier,
          total_subtotal, labor_cost, accessories_cost } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const estimated_cost_rmb = calculateWilfredCost({
    totalSubtotal: total_subtotal,
    laborCost: labor_cost,
    accessoriesCost: accessories_cost,
    overheadMultiplier: overhead_multiplier ?? 1.0,
    marginRate: margin_rate ?? 0.2,
  });

  const { data, error } = await db
    .from("wilfred_calculations")
    .update({
      approved,
      approved_at: approved ? new Date().toISOString() : null,
      wilfred_notes,
      margin_rate,
      overhead_multiplier,
      total_subtotal,
      labor_cost,
      accessories_cost,
      estimated_cost_rmb,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (approved) {
    await logChange(supabase, "wilfred_calculation", id, data.version ?? 1, "approved", null, data);

    // If all current tiers for this sheet are approved, advance status
    const { data: allCalcs } = await db
      .from("wilfred_calculations")
      .select("approved")
      .eq("cost_sheet_id", data.cost_sheet_id)
      .eq("is_current", true);

    const allApproved = allCalcs?.every((c: { approved: boolean }) => c.approved);
    if (allApproved) {
      const { data: sheetRow } = await db
        .from("factory_cost_sheets")
        .select("quotation_id")
        .eq("id", data.cost_sheet_id)
        .single();

      if (sheetRow) {
        await db.from("quotations").update({ status: "pending_natsuki" }).eq("id", sheetRow.quotation_id);
        await notifyWorkflowStep(sheetRow.quotation_id, "pending_natsuki");
      }
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("wilfred_calculations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
