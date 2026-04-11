import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote } = await (supabase as any)
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

  if (!quote) notFound();

  const wo = quote.work_orders as { wo_number: string; company_name: string; project_name: string } | null;
  const quoteTiers = ((quote.quotation_quantity_tiers ?? []) as { tier_label: string; quantity_type: string; quantity: number | null; sort_order: number }[])
    .sort((a, b) => a.sort_order - b.sort_order);

  // Use first factory cost sheet for packaging specs
  const sheets = Array.isArray(quote.factory_cost_sheets)
    ? quote.factory_cost_sheets
    : quote.factory_cost_sheets ? [quote.factory_cost_sheets] : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheet = (sheets as any[])[0] ?? null;

  // Flatten approved wilfred calcs across all sheets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allWilfredCalcs = (sheets as any[]).flatMap((s) =>
    Array.isArray(s.wilfred_calculations) ? s.wilfred_calculations : []
  ) as { tier_label: string; quantity: number; estimated_cost_rmb: number | null; approved: boolean }[];

  const approvedCalcs = allWilfredCalcs.filter((c) => c.approved);

  if (!sheet || approvedCalcs.length === 0) {
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

  // Extract packaging specs from packaging_lines JSONB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packagingLines: any[] = Array.isArray(sheet.packaging_lines) ? sheet.packaging_lines : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outerCarton = packagingLines.find((l: any) => l.type === "outer_carton");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pallet = packagingLines.find((l: any) => l.type === "pallet");

  const packagingDefaults = {
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
  };

  const quoteInfo = {
    companyName: wo?.company_name ?? "",
    projectName: wo?.project_name ?? "",
    woNumber: wo?.wo_number ?? "",
    canSize: quote.size_dimensions ?? "",
    moldNumber: sheet.mold_number ?? quote.mold_number ?? "",
    moldCostNew: sheet.mold_cost_new ?? null,
    moldCostModify: sheet.mold_cost_modify ?? null,
    moldLeadTime: sheet.mold_lead_time_days ?? null,
  };

  // Merge approved calcs with quantity_type from quote tiers
  const tiersForForm = approvedCalcs.map((calc) => {
    const quoteTier = quoteTiers.find((t) => t.tier_label === calc.tier_label);
    return {
      ...calc,
      quantity_type: quoteTier?.quantity_type ?? "units",
    };
  });

  const existingDDP = (quote.natsuki_ddp_calculations as Record<string, unknown>[]) ?? [];

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

      <DDPCalcForm
        locale={locale}
        quoteId={id}
        quoteInfo={quoteInfo}
        packagingDefaults={packagingDefaults}
        approvedCalcs={tiersForForm}
        existingDDP={existingDDP}
      />
    </div>
  );
}
