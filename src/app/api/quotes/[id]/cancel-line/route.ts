import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { line_index, mold_number } — cancel a line item and its downstream chain
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: quotationId } = await params;
  const { line_index } = await request.json();

  if (line_index === undefined) {
    return NextResponse.json({ error: "line_index required" }, { status: 400 });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get the quotation's molds array
  const { data: quote, error: qErr } = await db
    .from("quotations")
    .select("molds")
    .eq("id", quotationId)
    .single();

  if (qErr || !quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const molds = (quote.molds ?? []) as Record<string, unknown>[];
  if (line_index < 0 || line_index >= molds.length) {
    return NextResponse.json({ error: "Invalid line_index" }, { status: 400 });
  }

  // Mark the line item as cancelled in the JSONB
  molds[line_index] = { ...molds[line_index], cancelled: true };
  await db.from("quotations").update({ molds }).eq("id", quotationId);

  // Find the matching factory sheet(s) for this mold
  const moldNumber = molds[line_index].value as string;
  const { data: sheets } = await db
    .from("factory_cost_sheets")
    .select("id")
    .eq("quotation_id", quotationId)
    .eq("mold_number", moldNumber)
    .eq("is_current", true)
    .eq("is_cancelled", false);

  // If there are multiple sheets for the same mold number (variants),
  // we need to match by line index. For now, cancel all matching current sheets
  // that aren't already cancelled. In practice, the line_index in the molds array
  // maps 1:1 to factory sheets created in order.
  // Get all current non-cancelled sheets, ordered by creation, and pick the one at line_index offset
  const { data: allSheets } = await db
    .from("factory_cost_sheets")
    .select("id, mold_number")
    .eq("quotation_id", quotationId)
    .eq("is_current", true)
    .eq("is_cancelled", false)
    .order("created_at");

  // Map line items to sheets by position
  const activeLineIndices: number[] = [];
  molds.forEach((m, idx) => {
    if (!(m as { cancelled?: boolean }).cancelled || idx === line_index) {
      activeLineIndices.push(idx);
    }
  });

  // Find which sheet corresponds to this line_index
  const sheetIdx = activeLineIndices.indexOf(line_index);
  const targetSheet = allSheets?.[sheetIdx];

  if (targetSheet) {
    const sheetId = targetSheet.id;

    // Cancel the factory sheet
    await db.from("factory_cost_sheets")
      .update({ is_cancelled: true })
      .eq("id", sheetId);

    // Cancel downstream wilfred calcs
    await db.from("wilfred_calculations")
      .update({ is_cancelled: true })
      .eq("cost_sheet_id", sheetId)
      .eq("is_current", true);

    // Cancel downstream DDP calcs
    await db.from("natsuki_ddp_calculations")
      .update({ is_cancelled: true })
      .eq("cost_sheet_id", sheetId)
      .eq("is_current", true);

    // Cancel downstream customer quotes
    await db.from("customer_quotes")
      .update({ is_cancelled: true })
      .eq("cost_sheet_id", sheetId)
      .eq("is_current", true);
  }

  return NextResponse.json({ cancelled: true, line_index });
}
