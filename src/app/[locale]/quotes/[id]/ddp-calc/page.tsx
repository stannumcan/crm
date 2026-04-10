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
      id, status,
      work_orders(wo_number, company_name, project_name),
      quotation_quantity_tiers(tier_label, quantity_type, quantity, sort_order),
      factory_cost_sheets(
        outer_carton_qty,
        outer_carton_l, outer_carton_w, outer_carton_h, outer_carton_cbm,
        pallet_l, pallet_w, pallet_h,
        cans_per_pallet,
        factory_cost_tiers(tier_label, quantity, total_subtotal)
      ),
      wilfred_calculations(tier_label, quantity, estimated_cost_rmb, approved),
      natsuki_ddp_calculations(*)
    `)
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const wo = quote.work_orders as { wo_number: string; company_name: string; project_name: string } | null;
  const sheets = Array.isArray(quote.factory_cost_sheets) ? quote.factory_cost_sheets : [quote.factory_cost_sheets].filter(Boolean);
  const sheet = (sheets as Record<string, unknown>[] | null)?.[0] ?? null;

  const wilfredCalcs = (quote.wilfred_calculations as {
    tier_label: string;
    quantity: number;
    estimated_cost_rmb: number | null;
    approved: boolean;
  }[]) ?? [];

  const approvedCalcs = wilfredCalcs.filter((c) => c.approved);

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
          <h1 className="text-xl font-bold text-gray-900">DDP Calculation (Japan)</h1>
          {wo && (
            <p className="text-sm text-gray-500">{wo.wo_number} · {wo.project_name} · {wo.company_name}</p>
          )}
        </div>
      </div>

      <DDPCalcForm
        locale={locale}
        quoteId={id}
        approvedCalcs={approvedCalcs}
        sheet={sheet}
        existingDDP={existingDDP}
      />
    </div>
  );
}
