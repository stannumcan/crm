import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FactorySheetForm from "@/components/factory/FactorySheetForm";
import QuoteLineItems from "@/components/quotes/QuoteLineItems";

export default async function NewFactorySheetPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote } = await (supabase as any)
    .from("quotations")
    .select(`
      id, mold_number, size_dimensions, molds,
      printing_lid, printing_body, printing_bottom, printing_inner, printing_notes,
      embossment, embossment_components, embossment_notes,
      work_orders(wo_number, company_name, project_name),
      quotation_quantity_tiers(tier_label, quantity_type, quantity, sort_order)
    `)
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const wo = quote.work_orders as { wo_number: string; company_name: string; project_name: string } | null;
  const tiers = (quote.quotation_quantity_tiers as { tier_label: string; quantity_type: string; quantity: number | null; sort_order: number }[] | null) ?? [];
  // Extract thickness from first mold entry in the JSONB array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const molds = (quote.molds as any[]) ?? [];
  const tinThickness = molds[0]?.thickness ?? undefined;

  // Build default printing lines from quote request fields
  const isJa = locale === "ja" || locale === "zh";
  const ext = isJa ? "外面" : "Outside";
  const int = isJa ? "内面" : "Inside";
  const lid = isJa ? "蓋" : "Lid";
  const body = isJa ? "身" : "Body";
  const bottom = isJa ? "底" : "Bottom";
  const defaultPrintingLines: { surface: string; part: string; spec: string }[] = [];
  if (quote.printing_lid) defaultPrintingLines.push({ surface: ext, part: lid, spec: quote.printing_lid });
  if (quote.printing_body) defaultPrintingLines.push({ surface: ext, part: body, spec: quote.printing_body });
  if (quote.printing_bottom) defaultPrintingLines.push({ surface: ext, part: bottom, spec: quote.printing_bottom });
  if (quote.printing_inner) defaultPrintingLines.push({ surface: int, part: "", spec: quote.printing_inner });

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/quotes/${id}/factory-sheet`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Factory Cost Sheet</h1>
          {wo && (
            <p className="text-sm text-gray-500">{wo.wo_number} · {wo.project_name} · {wo.company_name}</p>
          )}
        </div>
      </div>

      {/* What's being requested — visible while filling in costs */}
      <div className="mb-6">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <QuoteLineItems
          molds={(quote.molds ?? null) as any}
          legacy={{
            mold_number: quote.mold_number as string | null,
            size_dimensions: quote.size_dimensions as string | null,
            printing_lid: quote.printing_lid as string | null,
            printing_body: quote.printing_body as string | null,
            printing_bottom: quote.printing_bottom as string | null,
            printing_inner: quote.printing_inner as string | null,
            embossment: quote.embossment as boolean | null,
            embossment_components: quote.embossment_components as string | null,
            embossment_notes: quote.embossment_notes as string | null,
          }}
        />
      </div>

      <FactorySheetForm
        locale={locale}
        quoteId={id}
        tiers={tiers.sort((a, b) => a.sort_order - b.sort_order)}
        existingSheet={null}
        existingTierCosts={[]}
        moldNumber={quote.mold_number ?? ""}
        productDimensions={quote.size_dimensions ?? ""}
        tinThickness={tinThickness}
        defaultPrintingLines={defaultPrintingLines.length > 0 ? defaultPrintingLines : undefined}
        defaultEmbossingLines={quote.embossment ? [{ component: quote.embossment_components ?? "", cost_rmb: "", notes: quote.embossment_notes ?? "" }] : undefined}
        returnTo={`/${locale}/quotes/${id}/factory-sheet`}
      />
    </div>
  );
}
