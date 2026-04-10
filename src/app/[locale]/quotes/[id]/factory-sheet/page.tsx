import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FactorySheetForm from "@/components/factory/FactorySheetForm";

export default async function FactorySheetPage({
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
      factory_cost_sheets(*)
    `)
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const wo = quote.work_orders as { wo_number: string; company_name: string; project_name: string } | null;
  const tiers = (quote.quotation_quantity_tiers as { tier_label: string; quantity_type: string; quantity: number | null; sort_order: number }[] | null) ?? [];
  const existingSheet = Array.isArray(quote.factory_cost_sheets)
    ? (quote.factory_cost_sheets as object[])[0] ?? null
    : quote.factory_cost_sheets ?? null;

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
          <h1 className="text-xl font-bold text-gray-900">Factory Cost Sheet</h1>
          {wo && (
            <p className="text-sm text-gray-500">{wo.wo_number} · {wo.project_name} · {wo.company_name}</p>
          )}
        </div>
      </div>

      <FactorySheetForm
        locale={locale}
        quoteId={id}
        tiers={tiers.sort((a, b) => a.sort_order - b.sort_order)}
        existingSheet={existingSheet}
        moldNumber={quote.mold_number ?? ""}
        productDimensions={quote.size_dimensions ?? ""}
      />
    </div>
  );
}
