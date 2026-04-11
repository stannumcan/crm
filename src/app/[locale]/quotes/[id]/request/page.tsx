import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import QuoteRequestView from "@/components/quotes/QuoteRequestView";

export default async function QuoteRequestPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error } = await (supabase as any)
    .from("quotations")
    .select(`
      *,
      work_orders(id, wo_number, company_name, project_name),
      quotation_quantity_tiers(*)
    `)
    .eq("id", id)
    .single();

  if (error || !quote) notFound();

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/quotes/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Button>
        </Link>
      </div>
      <QuoteRequestView quote={quote} quoteId={id} locale={locale} />
    </div>
  );
}
