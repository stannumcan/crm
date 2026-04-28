import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getListDivisionFilter } from "@/lib/divisions-server";
import QuoteTabNav from "@/components/quotes/QuoteTabNav";
import QuoteRequestsTable, { type QuoteRow } from "@/components/quotes/QuoteRequestsTable";

// Each tab is a view of the same quotations, filtered by which workflow step
// they've reached. Clicking a row drops you into that step's page.
// Quote appears on a step tab when its workflow status has REACHED that step
// (waiting/in-progress/done), not only when it has actual data rows. This way
// the Cost Calc tab shows quotes at pending_wilfred as "Needs action" even
// before Wilfred has saved anything.
const STATUS_ORDER = ["draft", "pending_factory", "pending_wilfred", "pending_natsuki", "sent", "approved"];
function hasReached(quoteStatus: string, stepKey: string): boolean {
  if (quoteStatus === "rejected") return false;
  const stepIdx = STATUS_ORDER.indexOf(stepKey);
  const curIdx = STATUS_ORDER.indexOf(quoteStatus);
  if (stepIdx < 0 || curIdx < 0) return false;
  return curIdx >= stepIdx;
}

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
    predicate: (q) => hasReached(q.status, "pending_factory"),
    stepKey: "pending_factory",
    emptyTitle: "No factory cost sheets yet",
    emptyDescription: "Quotes waiting on the factory or already complete will appear here.",
  },
  "wilfred-calc": {
    hrefSuffix: "/cost-calc",
    predicate: (q) => hasReached(q.status, "pending_wilfred"),
    stepKey: "pending_wilfred",
    emptyTitle: "No cost calcs yet",
    emptyDescription: "Quotes ready for cost calc (or already done) will appear here.",
  },
  "ddp-calc": {
    hrefSuffix: "/ddp-calc",
    predicate: (q) => hasReached(q.status, "pending_natsuki"),
    stepKey: "pending_natsuki",
    emptyTitle: "No DDP calcs yet",
    emptyDescription: "Quotes ready for DDP calc (or already done) will appear here.",
  },
  "customer-quote": {
    hrefSuffix: "/customer-quote",
    predicate: (q) => hasReached(q.status, "sent"),
    stepKey: "sent",
    emptyTitle: "No customer quotes yet",
    emptyDescription: "Quotes ready for customer-facing document (or already sent) will appear here.",
  },
};

interface QuotationWithRollup {
  id: string;
  status: string;
  quote_version: number | null;
  created_at: string | null;
  updated_at: string | null;
  // JSONB array of line items: { value: mould number, design_count?, ... }
  molds: { value?: string; design_count?: number }[] | null;
  quotation_quantity_tiers: {
    tier_label: string;
    quantity_type: string;
    quantity: number | null;
    sort_order: number;
  }[] | null;
  work_orders: {
    id: string | null;
    wo_number: string | null;
    company_id: string | null;
    company_name: string | null;
    project_name: string | null;
  } | null;
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
  const divFilter = await getListDivisionFilter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let quotesQuery = db
    .from("quotations")
    .select(`
      id, status, quote_version, created_at, updated_at, molds,
      work_orders(id, wo_number, company_id, company_name, project_name),
      quotation_quantity_tiers(tier_label, quantity_type, quantity, sort_order)
    `)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (divFilter) quotesQuery = quotesQuery.eq("division_id", divFilter);
  const { data } = await quotesQuery;

  const enriched: QuotationWithRollup[] = (data ?? []) as QuotationWithRollup[];

  const rows: QuoteRow[] = enriched.filter(tabConfig.predicate);

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
