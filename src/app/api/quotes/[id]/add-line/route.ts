import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { line_item } — add a new line item to an existing quotation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: quotationId } = await params;
  const { line_item } = await request.json();

  if (!line_item?.value) {
    return NextResponse.json({ error: "line_item with mold value required" }, { status: 400 });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get the quotation
  const { data: quote, error: qErr } = await db
    .from("quotations")
    .select("molds, quotation_quantity_tiers(tier_label, quantity_type, quantity, sort_order)")
    .eq("id", quotationId)
    .single();

  if (qErr || !quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  // Add the new line item to the molds array
  const molds = (quote.molds ?? []) as Record<string, unknown>[];
  const newLine = {
    line: molds.length + 1,
    ...line_item,
  };
  molds.push(newLine);
  await db.from("quotations").update({ molds }).eq("id", quotationId);

  // Auto-create a factory sheet for the new line item
  const tiers = (quote.quotation_quantity_tiers ?? []) as { tier_label: string; quantity_type: string; quantity: number | null; sort_order: number }[];

  const { data: sheet } = await db
    .from("factory_cost_sheets")
    .insert({
      quotation_id: quotationId,
      mold_number: line_item.value ?? null,
      product_dimensions: line_item.size ?? null,
      steel_thickness: line_item.thickness ? parseFloat(line_item.thickness) : null,
      sheet_date: new Date().toISOString().split("T")[0],
      printing_lines: line_item.printing_lines ?? [],
      embossing_lines: (line_item.embossing_lines ?? []).map((e: { component: string; notes?: string }) => ({
        component: e.component, cost_rmb: "", notes: e.notes ?? "",
      })),
      version: 1,
      is_current: true,
    })
    .select("id")
    .single();

  // Create tier cost rows for the new sheet
  if (sheet && tiers.length > 0) {
    await db.from("factory_cost_tiers").insert(
      tiers.map((t) => ({
        cost_sheet_id: sheet.id,
        tier_label: t.tier_label,
        quantity: t.quantity,
      }))
    );
  }

  return NextResponse.json({ added: true, line_index: molds.length - 1, sheet_id: sheet?.id });
}
