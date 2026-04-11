import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CustomerQuoteForm from "@/components/customer/CustomerQuoteForm";

export default async function CustomerQuotePage({
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
      id, status, mold_type, mold_number, size_dimensions, embossment,
      design_count, shipping_info_required,
      printing_lid, printing_body, printing_bottom, printing_inner, printing_notes,
      work_orders(id, wo_number, company_name, project_name),
      quotation_quantity_tiers(tier_label, quantity_type, quantity, sort_order),
      natsuki_ddp_calculations!quotation_id(
        id, tier_label, quantity, unit_price_jpy, total_revenue_jpy,
        selected_margin, shipping_cost_jpy, total_cost_jpy, manufacturing_cost_jpy,
        fx_rate_rmb_to_jpy
      ),
      factory_cost_sheets(
        mold_cost_new, mold_cost_modify, mold_lead_time_days,
        steel_type, steel_thickness, outer_carton_qty, outer_carton_config, mold_number
      ),
      customer_quotes(*)
    `)
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const wo = quote.work_orders as {
    id: string;
    wo_number: string;
    company_name: string;
    project_name: string;
  } | null;

  const ddpCalcs = (quote.natsuki_ddp_calculations as {
    id: string;
    tier_label: string;
    quantity: number;
    unit_price_jpy: number | null;
    total_revenue_jpy: number | null;
    selected_margin: number | null;
    shipping_cost_jpy: number | null;
    total_cost_jpy: number | null;
    manufacturing_cost_jpy: number | null;
    fx_rate_rmb_to_jpy: number | null;
  }[]) ?? [];

  const sheets = Array.isArray(quote.factory_cost_sheets)
    ? quote.factory_cost_sheets
    : [quote.factory_cost_sheets].filter(Boolean);

  const sheet = (sheets as {
    mold_cost_new: number | null;
    mold_cost_modify: number | null;
    mold_lead_time_days: number | null;
    steel_type: string | null;
    steel_thickness: number | null;
    outer_carton_qty: number | null;
    outer_carton_config: string | null;
    mold_number: string | null;
  }[] | null)?.[0] ?? null;

  const existingCQ = Array.isArray(quote.customer_quotes)
    ? (quote.customer_quotes as Record<string, unknown>[])[0] ?? null
    : (quote.customer_quotes as Record<string, unknown> | null);

  // Compute default printing lines from quotation fields
  const defaultPrintingLines = [
    quote.printing_lid && { part: "外面（蓋）", spec: quote.printing_lid as string },
    quote.printing_body && { part: "外面（身）", spec: quote.printing_body as string },
    quote.printing_bottom && { part: "外面（底）", spec: quote.printing_bottom as string },
    quote.printing_inner && { part: "内面（蓋）", spec: quote.printing_inner as string },
  ].filter(Boolean) as { part: string; spec: string }[];

  const defaultMaterial = sheet?.steel_type ?? "";
  const defaultThickness = sheet?.steel_thickness ? `${sheet.steel_thickness}㎜` : "";
  const defaultPacking = [
    sheet?.outer_carton_qty && `${sheet.outer_carton_qty}缶/箱`,
    sheet?.outer_carton_config,
  ].filter(Boolean).join("　");

  const sizeNote = (quote.size_dimensions as string) ?? "";

  // Get FX rate from the first DDP calc
  const fxRateFromDDP = ddpCalcs[0]?.fx_rate_rmb_to_jpy ?? null;

  if (ddpCalcs.length === 0) {
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
          <p className="font-medium">DDP calculation not found.</p>
          <p className="text-sm mt-1">Natsuki must complete the DDP calculation first.</p>
          <Link href={`/${locale}/quotes/${id}/ddp-calc`} className="inline-block mt-4">
            <Button variant="outline">Go to DDP Calc</Button>
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
          <h1 className="text-xl font-bold text-gray-900">御見積書 — Customer Quote</h1>
          {wo && (
            <p className="text-sm text-gray-500">
              {wo.wo_number} · {wo.project_name} · {wo.company_name}
            </p>
          )}
        </div>
      </div>

      <CustomerQuoteForm
        locale={locale}
        quoteId={id}
        woNumber={wo?.wo_number ?? ""}
        companyName={wo?.company_name ?? ""}
        projectName={wo?.project_name ?? ""}
        sizeNote={sizeNote}
        ddpCalcs={ddpCalcs}
        moldType={(quote.mold_type as string) ?? "existing"}
        moldCostNew={sheet?.mold_cost_new ?? null}
        moldLeadTimeDays={sheet?.mold_lead_time_days ?? null}
        defaultMaterial={defaultMaterial}
        defaultThickness={defaultThickness}
        defaultPrintingLines={defaultPrintingLines}
        defaultPacking={defaultPacking}
        fxRateFromDDP={fxRateFromDDP}
        existingCQ={existingCQ}
      />
    </div>
  );
}
