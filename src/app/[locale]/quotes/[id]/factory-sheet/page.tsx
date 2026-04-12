import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, FileText, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function FactorySheetListPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: quote } = await db
    .from("quotations")
    .select(`
      id, status, mold_number, molds,
      printing_lid, printing_body, printing_bottom, printing_inner, printing_notes,
      embossment, embossment_components, embossment_notes,
      work_orders(wo_number, company_name, project_name),
      factory_cost_sheets(id, mold_number, sheet_date, product_dimensions, created_at),
      quotation_quantity_tiers(tier_label, quantity_type, quantity, sort_order)
    `)
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const wo = quote.work_orders as { wo_number: string; company_name: string; project_name: string } | null;
  let sheets = (Array.isArray(quote.factory_cost_sheets)
    ? quote.factory_cost_sheets
    : quote.factory_cost_sheets ? [quote.factory_cost_sheets] : []) as { id: string; mold_number: string | null; sheet_date: string | null; product_dimensions: string | null; created_at: string }[];

  // ── Auto-create one sheet per mold if none exist ────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const molds = (quote.molds as any[]) ?? [];
  if (sheets.length === 0 && molds.length > 0) {
    const tiers = (quote.quotation_quantity_tiers ?? []) as { tier_label: string; quantity_type: string; quantity: number | null; sort_order: number }[];

    const sheetsToInsert = molds.map((m: { value?: string; size?: string; thickness?: string | null }) => ({
      quotation_id: id,
      mold_number: m.value ?? null,
      product_dimensions: m.size ?? null,
      steel_thickness: m.thickness ? parseFloat(m.thickness) : null,
      sheet_date: new Date().toISOString().split("T")[0],
      // Build printing lines from quote fields
      printing_lines: [
        ...(quote.printing_lid ? [{ surface: "外面", part: "蓋", spec: quote.printing_lid }] : []),
        ...(quote.printing_body ? [{ surface: "外面", part: "身", spec: quote.printing_body }] : []),
        ...(quote.printing_bottom ? [{ surface: "外面", part: "底", spec: quote.printing_bottom }] : []),
        ...(quote.printing_inner ? [{ surface: "内面", part: "", spec: quote.printing_inner }] : []),
      ],
      // Build embossing lines from quote
      embossing_lines: quote.embossment
        ? [{ component: quote.embossment_components ?? "", cost_rmb: "", notes: quote.embossment_notes ?? "" }]
        : [],
    }));

    const { data: created } = await db
      .from("factory_cost_sheets")
      .insert(sheetsToInsert)
      .select("id, mold_number, sheet_date, product_dimensions, created_at");

    if (created) {
      sheets = Array.isArray(created) ? created : [created];

      // Create tier cost rows for each sheet
      const tierRows = sheets.flatMap((sheet: { id: string }) =>
        tiers.map((t) => ({
          cost_sheet_id: sheet.id,
          tier_label: t.tier_label,
          quantity: t.quantity,
        }))
      );
      if (tierRows.length > 0) {
        await db.from("factory_cost_tiers").insert(tierRows);
      }
    }
  }

  const sorted = [...sheets].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/quotes/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Factory Cost Sheets</h1>
          {wo && (
            <p className="text-sm text-gray-500">{wo.wo_number} · {wo.project_name} · {wo.company_name}</p>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border border-dashed rounded-lg">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No cost sheets yet</p>
          </div>
        ) : (
          sorted.map((sheet, i) => (
            <div key={sheet.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-4">
                <span className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-50 text-blue-700 text-sm font-bold border border-blue-200">
                  {i + 1}
                </span>
                <div>
                  <p className="font-mono font-medium text-gray-900">{sheet.mold_number ?? "No mold number"}</p>
                  <p className="text-xs text-gray-500">
                    {sheet.product_dimensions && <span>{sheet.product_dimensions} · </span>}
                    {sheet.sheet_date ? new Date(sheet.sheet_date).toLocaleDateString() : "No date"}
                  </p>
                </div>
              </div>
              <Link href={`/${locale}/quotes/${id}/factory-sheet/${sheet.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </Link>
            </div>
          ))
        )}
      </div>

      <Link href={`/${locale}/quotes/${id}/factory-sheet/new`}>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Sheet
        </Button>
      </Link>
    </div>
  );
}
