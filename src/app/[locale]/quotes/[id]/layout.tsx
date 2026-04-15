import QuoteWorkflowStepper from "@/components/quotes/QuoteWorkflowStepper";
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

  // Look up the quote status so the stepper can compute done/current/upcoming.
  // RLS handles permission filtering — we don't need extra guards here.
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote } = await (supabase as any)
    .from("quotations")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  const status = (quote?.status as string | undefined) ?? "draft";

  return (
    <div className="flex flex-col min-h-full">
      <QuoteWorkflowStepper basePath={basePath} quoteStatus={status} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
