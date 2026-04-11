import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DDPCalcForm from "@/components/calculator/DDPCalcForm";

export default async function DDPCalcPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const tc = await getTranslations("common");

  const supabase = await createClient();

  // Fetch global shipping rate settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settingsRow } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", "ddp_shipping")
    .single();

  const shippingRates = {
    lcl_rate_per_cbm: settingsRow?.value?.lcl_rate_per_cbm ?? 23000,
    lcl_base_fee: settingsRow?.value?.lcl_base_fee ?? 10000,
    fcl_20gp_jpy: settingsRow?.value?.fcl_20gp_jpy ?? 250000,
    fcl_40gp_jpy: settingsRow?.value?.fcl_40gp_jpy ?? 400000,
    fcl_40hq_jpy: settingsRow?.value?.fcl_40hq_jpy ?? 450000,
    margin_values: (settingsRow?.value?.margin_values as number[] | undefined) ?? [60, 55, 50, 45, 40, 35, 30, 25],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error: queryError } = await (supabase as any)
    .from("quotations")
    .select(`
      id, status, mold_number, size_dimensions,
      work_orders(wo_number, company_name, project_name),
      quotation_quantity_tiers(tier_label, quantity_type, quantity, sort_order),
      factory_cost_sheets(
        id, mold_number, mold_cost_new, mold_cost_modify, mold_lead_time_days,
        packaging_lines,
        wilfred_calculations(tier_label, quantity, estimated_cost_rmb, approved)
      ),
      natsuki_ddp_calculations!quotation_id(*)
    `)
    .eq("id", id)
    .single();

  if (queryError) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-4">
          <p className="font-semibold text-red-800 mb-1">Query error</p>
          <p className="text-sm text-red-700 font-mono">{queryError.message}</p>
          <p className="text-xs text-red-500 mt-2">Code: {queryError.code}</p>
        </div>
      </div>
    );
  }

  if (!quote) notFound();

  const wo = quote.work_orders as { wo_number: string; company_name: string; project_name: string } | null;
  const quoteTiers = ((quote.quotation_quantity_tiers ?? []) as { tier_label: string; quantity_type: string; quantity: number | null; sort_order: number }[])
    .sort((a, b) => a.sort_order - b.sort_order);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheets = (Array.isArray(quote.factory_cost_sheets)
    ? quote.factory_cost_sheets
    : quote.factory_cost_sheets ? [quote.factory_cost_sheets] : []) as any[];

  const existingDDPAll = (quote.natsuki_ddp_calculations as Record<string, unknown>[]) ?? [];

  type SheetForDDP = {
    id: string;
    moldNumber: string | null;
    quoteInfo: {
      companyName: string; projectName: string; woNumber: string; canSize: string;
      moldNumber: string; moldCostNew: number | null; moldCostModify: number | null; moldLeadTime: number | null;
    };
    packagingDefaults: {
      pcsPerCarton: number | null; boxL: number | null; boxW: number | null; boxH: number | null;
      palletL: number | null; palletW: number | null; palletH: number | null; boxesPerPallet: number | null;
    };
    approvedCalcs: { tier_label: string; quantity: number; estimated_cost_rmb: number | null; approved: boolean; quantity_type: string }[];
    existingDDP: Record<string, unknown>[];
  };

  // Build per-sheet data — only include sheets with at least one approved wilfred calc
  const typedSheets: SheetForDDP[] = [];
  for (const sheet of sheets) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wilfredCalcs: { tier_label: string; quantity: number; estimated_cost_rmb: number | null; approved: boolean }[] =
      Array.isArray(sheet.wilfred_calculations) ? sheet.wilfred_calculations : [];

    const approvedCalcs = wilfredCalcs
      .filter((c) => c.approved)
      .map((calc) => {
        const quoteTier = quoteTiers.find((t) => t.tier_label === calc.tier_label);
        return { ...calc, quantity_type: quoteTier?.quantity_type ?? "units" };
      });

    if (approvedCalcs.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const packagingLines: any[] = Array.isArray(sheet.packaging_lines) ? sheet.packaging_lines : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outerCarton = packagingLines.find((l: any) => l.type === "outer_carton");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pallet = packagingLines.find((l: any) => l.type === "pallet");

    typedSheets.push({
      id: sheet.id,
      moldNumber: sheet.mold_number ?? null,
      quoteInfo: {
        companyName: wo?.company_name ?? "",
        projectName: wo?.project_name ?? "",
        woNumber: wo?.wo_number ?? "",
        canSize: quote.size_dimensions ?? "",
        moldNumber: sheet.mold_number ?? quote.mold_number ?? "",
        moldCostNew: sheet.mold_cost_new ?? null,
        moldCostModify: sheet.mold_cost_modify ?? null,
        moldLeadTime: sheet.mold_lead_time_days ?? null,
      },
      packagingDefaults: {
        pcsPerCarton: outerCarton?.tins ?? null,
        boxL: outerCarton?.l ?? null,
        boxW: outerCarton?.w ?? null,
        boxH: outerCarton?.h ?? null,
        palletL: pallet?.l ?? null,
        palletW: pallet?.w ?? null,
        palletH: pallet?.h ?? null,
        boxesPerPallet: (pallet?.tins && outerCarton?.tins)
          ? Math.round(pallet.tins / outerCarton.tins)
          : null,
      },
      approvedCalcs,
      existingDDP: existingDDPAll.filter((r) => r.cost_sheet_id === sheet.id),
    });
  }

  if (typedSheets.length === 0) {
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
          <p className="font-medium">Wilfred cost calculations not yet approved.</p>
          <p className="text-sm mt-1">All tiers must be approved by Wilfred before DDP calculation.</p>
          <Link href={`/${locale}/quotes/${id}/cost-calc`} className="inline-block mt-4">
            <Button variant="outline">Go to Cost Calc</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/quotes/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">DDP Calculation — 発注数量別単価計算表</h1>
          {wo && (
            <p className="text-sm text-gray-500">{wo.wo_number} · {wo.project_name} · {wo.company_name}</p>
          )}
        </div>
      </div>

      {typedSheets.length === 1 ? (
        <DDPCalcForm
          locale={locale}
          quoteId={id}
          costSheetId={typedSheets[0].id}
          quoteInfo={typedSheets[0].quoteInfo}
          packagingDefaults={typedSheets[0].packagingDefaults}
          approvedCalcs={typedSheets[0].approvedCalcs}
          existingDDP={typedSheets[0].existingDDP}
          shippingRates={shippingRates}
        />
      ) : (
        <Tabs defaultValue={typedSheets[0].id}>
          <TabsList className="mb-4">
            {typedSheets.map((sheet, i) => (
              <TabsTrigger key={sheet.id} value={sheet.id}>
                {sheet.moldNumber ?? `Mold ${i + 1}`}
              </TabsTrigger>
            ))}
          </TabsList>
          {typedSheets.map((sheet) => (
            <TabsContent key={sheet.id} value={sheet.id}>
              <DDPCalcForm
                locale={locale}
                quoteId={id}
                costSheetId={sheet.id}
                quoteInfo={sheet.quoteInfo}
                packagingDefaults={sheet.packagingDefaults}
                approvedCalcs={sheet.approvedCalcs}
                existingDDP={sheet.existingDDP}
                shippingRates={shippingRates}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
