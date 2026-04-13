import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import WilfredCalcForm from "@/components/calculator/WilfredCalcForm";

export default async function CostCalcPage({
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
      id, status,
      work_orders(wo_number, company_name, project_name),
      factory_cost_sheets(
        id,
        mold_number,
        steel_thickness,
        version,
        is_current,
        mold_cost_new,
        mold_cost_modify,
        embossing_lines,
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

  type Sheet = {
    id: string;
    mold_number: string | null;
    steel_thickness: number | null;
    version: number;
    is_current: boolean;
    mold_cost_new: number | null;
    mold_cost_modify: number | null;
    embossing_lines: { component: string; cost_rmb: string; notes: string }[] | null;
    wilfred_embossing_cost: number | null;
    wilfred_mold_cost_new: number | null;
    wilfred_mold_cost_adjust: number | null;
    wilfred_fees_approved: boolean;
    wilfred_fees_notes: string | null;
    factory_cost_tiers: {
      id: string;
      tier_label: string;
      quantity: number;
      total_subtotal: number | null;
      labor_cost: number | null;
      accessories_cost: number | null;
      container_info: string | null;
    }[];
    wilfred_calculations: {
      id: string;
      tier_label: string;
      total_subtotal: number;
      labor_cost: number;
      accessories_cost: number;
      overhead_multiplier: number;
      margin_rate: number;
      estimated_cost_rmb: number | null;
      approved: boolean;
      wilfred_notes: string | null;
    }[];
  };

  const sheets: Sheet[] = (Array.isArray(quote.factory_cost_sheets)
    ? quote.factory_cost_sheets
    : quote.factory_cost_sheets
    ? [quote.factory_cost_sheets]
    : []).filter((s: Sheet) => s.is_current !== false);

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
          <p className="text-sm mt-1">Annie must submit the factory cost sheet first.</p>
          <Link href={`/${locale}/quotes/${id}/factory-sheet`} className="inline-block mt-4">
            <Button variant="outline">Go to Factory Sheet</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/quotes/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Wilfred Cost Calculation</h1>
          {wo && (
            <p className="text-sm text-gray-500">
              {wo.wo_number} · {wo.project_name} · {wo.company_name}
              {sheets[0]?.steel_thickness ? ` · 板厚 ${sheets[0].steel_thickness} mm` : ""}
            </p>
          )}
        </div>
      </div>

      {sheets.length === 1 ? (
        <WilfredCalcForm
          locale={locale}
          quoteId={id}
          costSheetId={sheets[0].id}
          factoryTiers={sheets[0].factory_cost_tiers ?? []}
          existingCalcs={sheets[0].wilfred_calculations ?? []}
          sheetVersion={sheets[0].version}
          wilfredVersion={(sheets[0].wilfred_calculations as { version?: number }[])?.[0]?.version}
          basedOnSheetVersion={(sheets[0].wilfred_calculations as { based_on_sheet_version?: number }[])?.[0]?.based_on_sheet_version}
          fees={{
            moldCostNew: sheets[0].mold_cost_new,
            moldCostAdjust: sheets[0].mold_cost_modify,
            embossingLines: sheets[0].embossing_lines,
            wilfredEmbossingCost: sheets[0].wilfred_embossing_cost,
            wilfredMoldCostNew: sheets[0].wilfred_mold_cost_new,
            wilfredMoldCostAdjust: sheets[0].wilfred_mold_cost_adjust,
            feesApproved: sheets[0].wilfred_fees_approved,
            feesNotes: sheets[0].wilfred_fees_notes,
          }}
        />
      ) : (
        <Tabs defaultValue={sheets[0].id}>
          <TabsList className="mb-4">
            {sheets.map((sheet, i) => (
              <TabsTrigger key={sheet.id} value={sheet.id}>
                {sheet.mold_number ?? `Sheet ${i + 1}`}
                {sheet.steel_thickness ? ` · ${sheet.steel_thickness}mm` : ""}
              </TabsTrigger>
            ))}
          </TabsList>
          {sheets.map((sheet) => (
            <TabsContent key={sheet.id} value={sheet.id}>
              <WilfredCalcForm
                locale={locale}
                quoteId={id}
                costSheetId={sheet.id}
                factoryTiers={sheet.factory_cost_tiers ?? []}
                existingCalcs={sheet.wilfred_calculations ?? []}
                sheetVersion={sheet.version}
                wilfredVersion={(sheet.wilfred_calculations as { version?: number }[])?.[0]?.version}
                basedOnSheetVersion={(sheet.wilfred_calculations as { based_on_sheet_version?: number }[])?.[0]?.based_on_sheet_version}
                fees={{
                  moldCostNew: sheet.mold_cost_new,
                  moldCostAdjust: sheet.mold_cost_modify,
                  embossingLines: sheet.embossing_lines,
                  wilfredEmbossingCost: sheet.wilfred_embossing_cost,
                  wilfredMoldCostNew: sheet.wilfred_mold_cost_new,
                  wilfredMoldCostAdjust: sheet.wilfred_mold_cost_adjust,
                  feesApproved: sheet.wilfred_fees_approved,
                  feesNotes: sheet.wilfred_fees_notes,
                }}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
