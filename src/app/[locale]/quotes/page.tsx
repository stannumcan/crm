import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import QuoteTabNav from "@/components/quotes/QuoteTabNav";
import QuoteRequestsTable, { type QuoteRow } from "@/components/quotes/QuoteRequestsTable";

// Each tab is a view of the same quotations, filtered by which workflow step
// they've reached. Clicking a row drops you into that step's page.
const TABS: Record<string, {
  // The URL suffix appended to /quotes/{id}. Empty string = overview.
  hrefSuffix: string;
  // Returns true if this quote should appear on this tab.
  predicate: (q: QuotationWithRollup) => boolean;
  // The workflow step_key this tab represents. When set, the Progress column
  // shows step-relative status (waiting / needs action / complete) instead
  // of the raw quote status.
  stepKey?: string;
  emptyTitle: string;
  emptyDescription: string;
}> = {
  requests: {
    hrefSuffix: "",
    predicate: () => true,
    emptyTitle: "No quote requests yet",
    emptyDescription: "Create your first quote to kick off the workflow.",
  },
  "factory-sheet": {
    hrefSuffix: "/factory-sheet",
    predicate: (q) => q.has_factory_sheet,
    stepKey: "pending_factory",
    emptyTitle: "No factory cost sheets yet",
    emptyDescription: "Quotes will appear here once the factory starts entering costs.",
  },
  "wilfred-calc": {
    hrefSuffix: "/cost-calc",
    predicate: (q) => q.has_cost_calc,
    stepKey: "pending_wilfred",
    emptyTitle: "No cost calcs yet",
    emptyDescription: "Quotes will appear here once Wilfred runs the cost calc.",
  },
  "ddp-calc": {
    hrefSuffix: "/ddp-calc",
    predicate: (q) => q.has_ddp_calc,
    stepKey: "pending_natsuki",
    emptyTitle: "No DDP calcs yet",
    emptyDescription: "Quotes will appear here once Natsuki runs the DDP calc.",
  },
  "customer-quote": {
    hrefSuffix: "/customer-quote",
    predicate: (q) => q.has_customer_quote,
    stepKey: "sent",
    emptyTitle: "No customer quotes yet",
    emptyDescription: "Quotes will appear here once a customer quote has been generated.",
  },
};

// Shape of a quotation row enriched with presence flags for each workflow step.
interface QuotationWithRollup {
  id: string;
  status: string;
  quote_version: number | null;
  created_at: string | null;
  updated_at: string | null;
  work_orders: {
    id: string | null;
    wo_number: string | null;
    company_id: string | null;
    company_name: string | null;
    project_name: string | null;
  } | null;
  has_factory_sheet: boolean;
  has_cost_calc: boolean;
  has_ddp_calc: boolean;
  has_customer_quote: boolean;
}

export default async function QuotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const { tab: rawTab = "requests" } = await searchParams;
  const activeTab = TABS[rawTab] ? rawTab : "requests";
  const tabConfig = TABS[activeTab];

  const t = await getTranslations("quotes");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Single query — fetch all quotations + presence of each downstream step.
  // We use nested relations so we can derive boolean flags per quote.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await db
    .from("quotations")
    .select(`
      id, status, quote_version, created_at, updated_at,
      work_orders(id, wo_number, company_id, company_name, project_name),
      factory_cost_sheets(id, is_current, is_cancelled, wilfred_calculations(id, is_current)),
      natsuki_ddp_calculations!quotation_id(id, is_current),
      customer_quotes(id, is_current)
    `)
    .order("updated_at", { ascending: false })
    .limit(500);

  // Derive rollup flags
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched: QuotationWithRollup[] = (data ?? []).map((q: any) => {
    const factorySheets = Array.isArray(q.factory_cost_sheets) ? q.factory_cost_sheets : [];
    const currentSheets = factorySheets.filter((s: { is_current?: boolean; is_cancelled?: boolean }) =>
      s.is_current !== false && !s.is_cancelled,
    );
    const hasFactorySheet = currentSheets.length > 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasCostCalc = currentSheets.some((s: any) =>
      Array.isArray(s.wilfred_calculations) && s.wilfred_calculations.some((wc: { is_current?: boolean }) => wc.is_current !== false),
    );

    const ddpCalcs = Array.isArray(q.natsuki_ddp_calculations) ? q.natsuki_ddp_calculations : [];
    const hasDDPCalc = ddpCalcs.some((d: { is_current?: boolean }) => d.is_current !== false);

    const customerQuotes = Array.isArray(q.customer_quotes) ? q.customer_quotes : [];
    const hasCustomerQuote = customerQuotes.some((cq: { is_current?: boolean }) => cq.is_current !== false);

    return {
      id: q.id,
      status: q.status,
      quote_version: q.quote_version,
      created_at: q.created_at,
      updated_at: q.updated_at,
      work_orders: q.work_orders,
      has_factory_sheet: hasFactorySheet,
      has_cost_calc: hasCostCalc,
      has_ddp_calc: hasDDPCalc,
      has_customer_quote: hasCustomerQuote,
    };
  });

  const rows: QuoteRow[] = enriched
    .filter(tabConfig.predicate)
    .map((q) => ({
      id: q.id,
      status: q.status,
      quote_version: q.quote_version,
      created_at: q.created_at,
      updated_at: q.updated_at,
      work_orders: q.work_orders,
    }));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rows.length} {tc("total")}</p>
        </div>
        {activeTab === "requests" && (
          <Link href={`/${locale}/quotes/new`}>
            <Button className="gap-2">
              <FileText className="h-4 w-4" />
              {t("new")}
            </Button>
          </Link>
        )}
      </div>

      {/* Tab Nav */}
      <QuoteTabNav locale={locale} activeTab={activeTab} />

      {/* Table — same component for every tab, different row destination */}
      <div className="mt-3">
        <QuoteRequestsTable
          rows={rows}
          locale={locale}
          rowHrefSuffix={tabConfig.hrefSuffix}
          stepKey={tabConfig.stepKey}
          emptyTitle={tabConfig.emptyTitle}
          emptyDescription={tabConfig.emptyDescription}
          emptyActionLabel={activeTab === "requests" ? "New Quote Request" : undefined}
          emptyActionHref={activeTab === "requests" ? `/${locale}/quotes/new` : undefined}
        />
      </div>
    </div>
  );
}
