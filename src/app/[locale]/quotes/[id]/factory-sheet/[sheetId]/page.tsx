import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FactorySheetForm from "@/components/factory/FactorySheetForm";

export default async function EditFactorySheetPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; sheetId: string }>;
}) {
  const { locale, id, sheetId } = await params;
  const tc = await getTranslations("common");

  const supabase = await createClient();

  const [quoteRes, sheetRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("quotations")
      .select(`
        id, mold_number, size_dimensions, molds,
        work_orders(wo_number, company_name, project_name),
        quotation_quantity_tiers(tier_label, quantity_type, quantity, sort_order)
      `)
      .eq("id", id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("factory_cost_sheets")
      .select("*, factory_cost_tiers(*)")
      .eq("id", sheetId)
      .single(),
  ]);

  if (!quoteRes.data || !sheetRes.data) notFound();

  const quote = quoteRes.data;
  const sheet = sheetRes.data;
  const wo = quote.work_orders as { wo_number: string; company_name: string; project_name: string } | null;
  const tiers = (quote.quotation_quantity_tiers as { tier_label: string; quantity_type: string; quantity: number | null; sort_order: number }[] | null) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingTierCosts = (sheet.factory_cost_tiers ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const molds = (quote.molds as any[]) ?? [];
  // Match mold by mold_number to find the right thickness (fall back to first mold)
  const matchedMold = molds.find((m: any) => m.value === sheet.mold_number) ?? molds[0];
  const tinThickness = matchedMold?.thickness ?? undefined;

  // Look up mold ID and image from the molds table
  let moldDbId: string | null = null;
  let moldDbImageUrl: string | null = null;
  if (sheet.mold_number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: moldRecord } = await (supabase as any)
      .from("molds")
      .select("id, image_url")
      .eq("mold_number", sheet.mold_number)
      .single();
    if (moldRecord) {
      moldDbId = moldRecord.id;
      moldDbImageUrl = moldRecord.image_url;
    }
  }

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
          <h1 className="text-xl font-bold text-gray-900">Edit Factory Cost Sheet</h1>
          {wo && (
            <p className="text-sm text-gray-500">{wo.wo_number} · {wo.project_name} · {wo.company_name}</p>
          )}
          {sheet.ref_number && (
            <p className="text-xs font-mono text-blue-700 mt-0.5">{sheet.ref_number}</p>
          )}
        </div>
      </div>

      <FactorySheetForm
        locale={locale}
        quoteId={id}
        tiers={tiers.sort((a, b) => a.sort_order - b.sort_order)}
        existingSheet={sheet}
        existingTierCosts={existingTierCosts}
        moldNumber={quote.mold_number ?? ""}
        productDimensions={quote.size_dimensions ?? ""}
        tinThickness={tinThickness}
        initialMoldImageUrl={moldDbImageUrl ?? (sheet.mold_image_url as string | null)}
        initialMoldId={moldDbId}
        returnTo={`/${locale}/quotes/${id}/factory-sheet`}
      />
    </div>
  );
}
