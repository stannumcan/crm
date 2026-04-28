import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CostCalcWrapper from "@/components/calculator/CostCalcWrapper";
import { summarisePrintingSpec } from "@/lib/printing";

export default async function CostCalcPage({
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
      id, status, molds,
      work_orders(wo_number, company_name, project_name),
      factory_cost_sheets(
        id,
        mold_number,
        ref_number,
        product_dimensions,
        steel_thickness,
        version,
        is_current,
        is_cancelled,
        mold_cost_new,
        mold_cost_modify,
        mold_lead_time_days,
        mold_image_url,
        printing_lines,
        embossing_lines,
        packaging_lines,
        attachments,
        wilfred_embossing_cost,
        wilfred_mold_cost_new,
        wilfred_mold_cost_adjust,
        wilfred_fees_approved,
        wilfred_fees_notes,
        factory_cost_tiers(*),
        wilfred_calculations(*)
      )
    `)
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const wo = quote.work_orders as { wo_number: string; company_name: string; project_name: string } | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheets = ((Array.isArray(quote.factory_cost_sheets)
    ? quote.factory_cost_sheets
    : quote.factory_cost_sheets ? [quote.factory_cost_sheets] : []) as any[])
    .filter((s: { is_current?: boolean; is_cancelled?: boolean }) => s.is_current !== false && !s.is_cancelled);

  // Filter wilfred calcs to current version only
  for (const sheet of sheets) {
    if (Array.isArray(sheet.wilfred_calculations)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sheet.wilfred_calculations = sheet.wilfred_calculations.filter((wc: any) => wc.is_current !== false);
    }
  }

  if (sheets.length === 0) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/${locale}/quotes/${id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {tc("back")}
            </Button>
          </Link>
        </div>
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-8 text-center text-amber-700">
          <p className="font-medium">Factory cost sheet not found.</p>
          <p className="text-sm mt-1">The factory must submit the cost sheet first.</p>
          <Link href={`/${locale}/quotes/${id}/factory-sheet`} className="inline-block mt-4">
            <Button variant="outline">Go to Factory Sheet</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Build sheet entries with sidebar data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheetEntries: any[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteMolds = (quote.molds as any[]) ?? [];

  for (const sheet of sheets) {
    const wilfredCalcs = sheet.wilfred_calculations ?? [];
    const wilfredVersion = wilfredCalcs[0]?.version;
    const basedOnSheetVersion = wilfredCalcs[0]?.based_on_sheet_version;
    const allApproved = wilfredCalcs.length > 0
      && wilfredCalcs.every((wc: { approved: boolean }) => wc.approved)
      && sheet.wilfred_fees_approved;

    // Look up mold image
    let moldImageUrl = sheet.mold_image_url ?? null;
    if (!moldImageUrl && sheet.mold_number) {
      const { data: moldRow } = await db.from("molds").select("image_url").eq("mold_number", sheet.mold_number).maybeSingle();
      moldImageUrl = moldRow?.image_url ?? null;
    }

    sheetEntries.push({
      id: sheet.id,
      moldNumber: sheet.mold_number ?? null,
      refNumber: sheet.ref_number ?? null,
      variantLabel: quoteMolds.find((m: { value?: string }) => m.value === sheet.mold_number)?.variant_label ?? null,
      printingSpec: summarisePrintingSpec(sheet.printing_lines),
      steelThickness: sheet.steel_thickness ?? null,
      version: sheet.version ?? 1,
      wilfredVersion,
      basedOnSheetVersion,
      isApproved: allApproved,
      factoryTiers: sheet.factory_cost_tiers ?? [],
      existingCalcs: wilfredCalcs,
      fees: {
        moldCostNew: sheet.mold_cost_new,
        moldCostAdjust: sheet.mold_cost_modify,
        embossingLines: sheet.embossing_lines,
        wilfredEmbossingCost: sheet.wilfred_embossing_cost,
        wilfredMoldCostNew: sheet.wilfred_mold_cost_new,
        wilfredMoldCostAdjust: sheet.wilfred_mold_cost_adjust,
        feesApproved: sheet.wilfred_fees_approved,
        feesNotes: sheet.wilfred_fees_notes,
      },
      sheetRef: {
        moldNumber: sheet.mold_number,
        productDimensions: sheet.product_dimensions,
        steelThickness: sheet.steel_thickness,
        version: sheet.version ?? 1,
        moldCostNew: sheet.mold_cost_new,
        moldCostModify: sheet.mold_cost_modify,
        moldLeadTimeDays: sheet.mold_lead_time_days,
        moldImageUrl,
        printingLines: sheet.printing_lines,
        embossingLines: sheet.embossing_lines,
        packagingLines: sheet.packaging_lines,
        tierCosts: sheet.factory_cost_tiers ?? [],
        attachments: Array.isArray(sheet.attachments) ? sheet.attachments : null,
      },
    });
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/quotes/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cost Calculation</h1>
          {wo && (
            <p className="text-sm text-gray-500">
              {wo.wo_number} · {wo.project_name} · {wo.company_name}
            </p>
          )}
        </div>
      </div>

      <CostCalcWrapper
        locale={locale}
        quoteId={id}
        sheets={sheetEntries}
      />
    </div>
  );
}
