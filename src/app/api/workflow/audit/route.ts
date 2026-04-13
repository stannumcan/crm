import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/workflow/audit?quotation_id=xxx
// Returns all change log entries for a quotation across all entity types
export async function GET(request: NextRequest) {
  const quotationId = request.nextUrl.searchParams.get("quotation_id");
  if (!quotationId) return NextResponse.json([]);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get all factory sheet IDs for this quotation (all versions)
  const { data: sheets } = await db
    .from("factory_cost_sheets")
    .select("id")
    .eq("quotation_id", quotationId);
  const sheetIds = (sheets ?? []).map((s: { id: string }) => s.id);

  // Get all wilfred calc IDs for these sheets
  const wilfredIds: string[] = [];
  if (sheetIds.length > 0) {
    const { data: calcs } = await db
      .from("wilfred_calculations")
      .select("id")
      .in("cost_sheet_id", sheetIds);
    wilfredIds.push(...(calcs ?? []).map((c: { id: string }) => c.id));
  }

  // Get all DDP calc IDs
  const { data: ddps } = await db
    .from("natsuki_ddp_calculations")
    .select("id")
    .eq("quotation_id", quotationId);
  const ddpIds = (ddps ?? []).map((d: { id: string }) => d.id);

  // Get all customer quote IDs
  const { data: cqs } = await db
    .from("customer_quotes")
    .select("id")
    .eq("quotation_id", quotationId);
  const cqIds = (cqs ?? []).map((c: { id: string }) => c.id);

  // Collect all entity IDs
  const allIds = [...sheetIds, ...wilfredIds, ...ddpIds, ...cqIds];
  if (allIds.length === 0) return NextResponse.json([]);

  // Fetch all changelog entries
  const { data: entries } = await db
    .from("workflow_change_log")
    .select("*")
    .in("entity_id", allIds)
    .order("changed_at", { ascending: false })
    .limit(200);

  return NextResponse.json(entries ?? []);
}
