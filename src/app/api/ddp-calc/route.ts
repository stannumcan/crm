import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateDDP, type DDPInputs } from "@/lib/calculations";
import { notifyWorkflowStep } from "@/lib/workflow-notify";
import { getNextVersion, supersedeCurrent, logChange } from "@/lib/versioning";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { quotation_id, annie_quotation_id, cost_sheet_id, tiers } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get upstream versions + ref_number
  const { data: sheetRow } = await db
    .from("factory_cost_sheets")
    .select("version, ref_number")
    .eq("id", cost_sheet_id)
    .single();
  const basedOnSheetVersion = sheetRow?.version ?? 1;
  const dcRefNumber = sheetRow?.ref_number ? `${sheetRow.ref_number}/DC` : null;

  const { data: wilfredRow } = await db
    .from("wilfred_calculations")
    .select("version")
    .eq("cost_sheet_id", cost_sheet_id)
    .eq("is_current", true)
    .limit(1)
    .single();
  const basedOnWilfredVersion = wilfredRow?.version ?? 1;

  // Get next version for this cost_sheet
  const filters: Record<string, string> = { quotation_id };
  if (cost_sheet_id) filters.cost_sheet_id = cost_sheet_id;
  const newVersion = await getNextVersion(supabase, "natsuki_ddp_calculations", filters);

  // Supersede old rows (instead of deleting)
  if (newVersion > 1) {
    await supersedeCurrent(supabase, "natsuki_ddp_calculations", filters);
  }

  const records = tiers.map((t: DDPInputs & { tier_label: string; manualUnitPriceJpy?: number }) => {
    const result = calculateDDP(t);
    // Apply manual override if set
    const finalUnitPrice = t.manualUnitPriceJpy && t.manualUnitPriceJpy > 0 ? t.manualUnitPriceJpy : result.unitPriceJpy;
    const finalRevenue = finalUnitPrice * t.customerOrderQty;
    return {
      quotation_id,
      annie_quotation_id,
      cost_sheet_id: cost_sheet_id ?? null,
      tier_label: t.tier_label,
      quantity: t.customerOrderQty,
      rmb_unit_price: t.rmbUnitPrice,
      fx_rate_rmb_to_jpy: t.fxRate,
      shipping_type: t.shippingType,
      shipping_cost_jpy: result.shippingCostJpy,
      buffer_pct: t.bufferPct,
      import_duty_rate: t.importDutyRate,
      consumption_tax_rate: t.consumptionTaxRate,
      cartons_ordered: result.cartonsOrdered,
      factory_production_qty: result.factoryProductionQty,
      pallets: result.pallets,
      total_cbm: result.totalCBM,
      manufacturing_cost_jpy: result.manufacturingCostJpy,
      total_cost_jpy: result.totalCostJpy,
      selected_margin: t.selectedMargin,
      unit_price_jpy: finalUnitPrice,
      total_revenue_jpy: finalRevenue,
      version: newVersion,
      is_current: true,
      based_on_sheet_version: basedOnSheetVersion,
      based_on_wilfred_version: basedOnWilfredVersion,
      ref_number: dcRefNumber,
    };
  });

  const { data, error } = await db
    .from("natsuki_ddp_calculations")
    .insert(records)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const row of data ?? []) {
    await logChange(supabase, "natsuki_ddp_calculation", row.id, newVersion, newVersion === 1 ? "created" : "edited", null, row);
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("natsuki_ddp_calculations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
