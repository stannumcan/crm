import QuoteWorkflowStepper from "@/components/quotes/QuoteWorkflowStepper";
import QuoteContextBar from "@/components/quotes/QuoteContextBar";
import { createClient } from "@/lib/supabase/server";

export default async function QuoteDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const basePath = `/${locale}/quotes/${id}`;

  // Look up the quote + WO info so both the stepper (status) and the
  // context bar (WO number, company, project, urgency) can render.
  // RLS handles permission filtering — we don't need extra guards here.
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote } = await (supabase as any)
    .from("quotations")
    .select(`
      status, urgency, pricing_changed, design_count, size_dimensions, quote_version,
      work_orders(wo_number, company_name, project_name)
    `)
    .eq("id", id)
    .maybeSingle();

  const status = (quote?.status as string | undefined) ?? "draft";
  const wo = quote?.work_orders as { wo_number: string | null; company_name: string | null; project_name: string | null } | null;

  return (
    <div className="flex flex-col min-h-full">
      <QuoteWorkflowStepper basePath={basePath} quoteStatus={status} />
      <QuoteContextBar
        locale={locale}
        quoteId={id}
        woNumber={wo?.wo_number ?? null}
        quoteVersion={(quote?.quote_version as number | null | undefined) ?? null}
        companyName={wo?.company_name ?? null}
        projectName={wo?.project_name ?? null}
        status={status}
        urgency={!!quote?.urgency}
        pricingChanged={!!quote?.pricing_changed}
        designCount={quote?.design_count ?? null}
        size={quote?.size_dimensions ?? null}
      />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
