import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/workflow/history?type=factory_cost_sheet&group_id=xxx
// or  /api/workflow/history?type=wilfred_calculation&cost_sheet_id=xxx
// Returns all versions + change log for an entity group
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const groupId = searchParams.get("group_id");
  const costSheetId = searchParams.get("cost_sheet_id");
  const quotationId = searchParams.get("quotation_id");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Fetch all versions of the entity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let versions: any[] = [];

  if (type === "factory_cost_sheet" && groupId) {
    const { data } = await db
      .from("factory_cost_sheets")
      .select("id, version, is_current, mold_number, product_dimensions, steel_thickness, mold_cost_new, mold_cost_modify, printing_lines, embossing_lines, based_on_quote_version, superseded_at, created_at, created_by")
      .eq("sheet_group_id", groupId)
      .order("version", { ascending: false });
    versions = data ?? [];
  } else if (type === "wilfred_calculation" && costSheetId) {
    const { data } = await db
      .from("wilfred_calculations")
      .select("id, version, is_current, tier_label, quantity, total_subtotal, labor_cost, accessories_cost, overhead_multiplier, margin_rate, estimated_cost_rmb, approved, based_on_sheet_version, superseded_at, created_at, created_by")
      .eq("cost_sheet_id", costSheetId)
      .order("version", { ascending: false })
      .order("tier_label");
    versions = data ?? [];
  } else if (type === "natsuki_ddp_calculation" && costSheetId) {
    const { data } = await db
      .from("natsuki_ddp_calculations")
      .select("id, version, is_current, tier_label, quantity, rmb_unit_price, fx_rate_rmb_to_jpy, unit_price_jpy, total_revenue_jpy, selected_margin, based_on_sheet_version, based_on_wilfred_version, superseded_at, created_at, created_by")
      .eq("cost_sheet_id", costSheetId)
      .order("version", { ascending: false })
      .order("tier_label");
    versions = data ?? [];
  } else if (type === "customer_quote" && (costSheetId || quotationId)) {
    let query = db
      .from("customer_quotes")
      .select("id, version, is_current, winhoop_quote_number, customer_name, mold_cost_jpy, emboss_cost_jpy, printing_lines, based_on_ddp_version, based_on_sheet_version, superseded_at, created_at, created_by")
      .order("version", { ascending: false });
    if (costSheetId) query = query.eq("cost_sheet_id", costSheetId);
    else if (quotationId) query = query.eq("quotation_id", quotationId);
    const { data } = await query;
    versions = data ?? [];
  }

  // Fetch change log entries
  const entityIds = versions.map((v: { id: string }) => v.id);
  let changelog: unknown[] = [];
  if (entityIds.length > 0 && type) {
    const { data } = await db
      .from("workflow_change_log")
      .select("*")
      .eq("entity_type", type)
      .in("entity_id", entityIds)
      .order("changed_at", { ascending: false });
    changelog = data ?? [];
  }

  return NextResponse.json({ versions, changelog });
}
