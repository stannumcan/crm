import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateDDP, type DDPInputs } from "@/lib/calculations";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { quotation_id, annie_quotation_id, tiers } = body;

  const records = tiers.map((t: DDPInputs & { tier_label: string }) => {
    const result = calculateDDP(t);
    return {
      quotation_id,
      annie_quotation_id,
      tier_label: t.tier_label,
      quantity: t.customerOrderQty,
      rmb_unit_price: t.rmbUnitPrice,
      fx_rate_rmb_to_jpy: t.fxRate,
      shipping_type: t.shippingType,
      shipping_cost_jpy: result.shippingCostJpy,
      import_duty_rate: t.importDutyRate,
      consumption_tax_rate: t.consumptionTaxRate,
      cartons_ordered: result.cartonsOrdered,
      factory_production_qty: result.factoryProductionQty,
      pallets: result.pallets,
      total_cbm: result.totalCBM,
      manufacturing_cost_jpy: result.manufacturingCostJpy,
      total_cost_jpy: result.totalCostJpy,
      selected_margin: t.selectedMargin,
      unit_price_jpy: result.unitPriceJpy,
      total_revenue_jpy: result.totalRevenueJpy,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("natsuki_ddp_calculations")
    .insert(records)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update quotation status to sent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quotations")
    .update({ status: "sent" })
    .eq("id", quotation_id);

  return NextResponse.json(data, { status: 201 });
}
