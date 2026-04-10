import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QuoteRequestForm from "@/components/quotes/QuoteRequestForm";

export default async function NewQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ wo_id?: string; wo_number?: string }>;
}) {
  const { locale } = await params;
  const { wo_id, wo_number } = await searchParams;
  const t = await getTranslations("quotes");
  const tc = await getTranslations("common");

  // If no wo_id, redirect to workorders list so user picks one first
  if (!wo_id || !wo_number) {
    redirect(`/${locale}/workorders`);
  }

  // Verify the WO exists
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wo } = await (supabase as any)
    .from("work_orders")
    .select("id, wo_number")
    .eq("id", wo_id)
    .single();

  if (!wo) {
    redirect(`/${locale}/workorders`);
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/workorders/${wo_id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("new")}</h1>
      </div>

      <QuoteRequestForm locale={locale} woId={wo_id} woNumber={wo_number} />
    </div>
  );
}
