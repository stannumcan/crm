import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import QuoteTabNav from "@/components/quotes/QuoteTabNav";
import DeleteButton from "@/components/quotes/DeleteButton";
import QuoteRequestsTable, { type QuoteRow } from "@/components/quotes/QuoteRequestsTable";

// ── Table wrappers ───────────────────────────────────────────────────────────
function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-xs font-medium text-muted-foreground px-3 py-2.5 ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-sm ${className}`}>{children}</td>;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function QuotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const { tab: activeTab = "requests" } = await searchParams;

  const t = await getTranslations("quotes");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // ── Fetch data for active tab only ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];

  if (activeTab === "requests") {
    const { data } = await db
      .from("quotations")
      .select("*, work_orders(id, wo_number, company_id, company_name, project_name)")
      .order("updated_at", { ascending: false })
      .limit(500);
    rows = data ?? [];
  } else if (activeTab === "factory-sheet") {
    const { data } = await db
      .from("factory_cost_sheets")
      .select("id, mold_number, steel_thickness, sheet_date, version, created_at, quotation_id, quotations(id, work_orders(wo_number, company_name, project_name))")
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(500);
    rows = data ?? [];
  } else if (activeTab === "wilfred-calc") {
    const { data } = await db
      .from("wilfred_calculations")
      .select("id, quantity, estimated_cost_rmb, margin_rate, approved, version, created_at, cost_sheet_id, factory_cost_sheets(id, mold_number, quotation_id, quotations(id, work_orders(wo_number, company_name, project_name)))")
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(500);
    rows = data ?? [];
  } else if (activeTab === "ddp-calc") {
    const { data } = await db
      .from("natsuki_ddp_calculations")
      .select("id, tier_label, quantity, unit_price_jpy, total_revenue_jpy, version, created_at, quotation_id, quotations(id, work_orders(wo_number, company_name, project_name))")
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(500);
    rows = data ?? [];
  } else if (activeTab === "customer-quote") {
    const { data } = await db
      .from("customer_quotes")
      .select("id, winhoop_quote_number, customer_name, date_sent, version, created_at, quotation_id, quotations(id, work_orders(wo_number, company_name, project_name))")
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(500);
    rows = data ?? [];
  }

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

      {/* Table */}
      <div className={activeTab === "requests" ? "mt-3" : "border border-t-0 rounded-b-lg overflow-hidden bg-card"}>
        {/* ── Quote Requests ──────────────────────────────────────────── */}
        {activeTab === "requests" && (
          <QuoteRequestsTable rows={rows as QuoteRow[]} locale={locale} />
        )}

        {/* ── Factory Cost Sheets ─────────────────────────────────────── */}
        {activeTab === "factory-sheet" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <Th>WO #</Th>
                <Th>Company</Th>
                <Th>Mold #</Th>
                <Th>Steel (mm)</Th>
                <Th>Sheet Date</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No factory sheets yet</td></tr>
              )}
              {rows.map((fs) => {
                const wo = fs.quotations?.work_orders;
                const quotationId = fs.quotation_id;
                return (
                  <tr key={fs.id} className="hover:bg-muted/30 transition-colors">
                    <Td><span className="font-mono font-semibold text-blue-700">{wo?.wo_number ?? "—"}</span></Td>
                    <Td className="font-medium">{wo?.company_name ?? "—"}</Td>
                    <Td className="font-mono text-xs">{fs.mold_number ?? "—"}</Td>
                    <Td className="text-muted-foreground">{fs.steel_thickness ?? "—"}</Td>
                    <Td className="text-muted-foreground">{fs.sheet_date ? new Date(fs.sheet_date).toLocaleDateString() : "—"}</Td>
                    <Td>
                      <div className="flex items-center gap-0.5 justify-end">
                        <Link href={`/${locale}/quotes/${quotationId}/factory-sheet/${fs.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                        <DeleteButton endpoint={`/api/factory-sheets?id=${fs.id}`} label={`factory sheet ${fs.mold_number ?? ""}`} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── Cost Calc ────────────────────────────────────────────── */}
        {activeTab === "wilfred-calc" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <Th>WO #</Th>
                <Th>Company</Th>
                <Th>Mold #</Th>
                <Th>Qty</Th>
                <Th>Est. Cost (RMB)</Th>
                <Th>Margin</Th>
                <Th>Approved</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-10">No cost calculations yet</td></tr>
              )}
              {rows.map((wc) => {
                const fs = wc.factory_cost_sheets;
                const wo = fs?.quotations?.work_orders;
                const quotationId = fs?.quotation_id;
                return (
                  <tr key={wc.id} className="hover:bg-muted/30 transition-colors">
                    <Td><span className="font-mono font-semibold text-blue-700">{wo?.wo_number ?? "—"}</span></Td>
                    <Td className="font-medium">{wo?.company_name ?? "—"}</Td>
                    <Td className="font-mono text-xs">{fs?.mold_number ?? "—"}</Td>
                    <Td className="text-muted-foreground">{wc.quantity ? wc.quantity.toLocaleString() : "—"}</Td>
                    <Td className="text-muted-foreground">{wc.estimated_cost_rmb ? `¥${Number(wc.estimated_cost_rmb).toFixed(4)}` : "—"}</Td>
                    <Td className="text-muted-foreground">{wc.margin_rate ? `${(Number(wc.margin_rate) * 100).toFixed(0)}%` : "—"}</Td>
                    <Td>
                      {wc.approved
                        ? <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50">Approved</Badge>
                        : <Badge variant="secondary" className="text-xs">Pending</Badge>
                      }
                    </Td>
                    <Td>
                      <div className="flex items-center gap-0.5 justify-end">
                        {quotationId && (
                          <Link href={`/${locale}/quotes/${quotationId}/cost-calc`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <DeleteButton endpoint={`/api/wilfred-calc?id=${wc.id}`} label="this calculation" />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── DDP Calculation ─────────────────────────────────────────── */}
        {activeTab === "ddp-calc" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <Th>WO #</Th>
                <Th>Company</Th>
                <Th>Qty</Th>
                <Th>Unit Price (JPY)</Th>
                <Th>Total Revenue (JPY)</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No DDP calculations yet</td></tr>
              )}
              {rows.map((ddp) => {
                const wo = ddp.quotations?.work_orders;
                const quotationId = ddp.quotation_id;
                return (
                  <tr key={ddp.id} className="hover:bg-muted/30 transition-colors">
                    <Td><span className="font-mono font-semibold text-blue-700">{wo?.wo_number ?? "—"}</span></Td>
                    <Td className="font-medium">{wo?.company_name ?? "—"}</Td>
                    <Td className="text-muted-foreground">{ddp.quantity ? ddp.quantity.toLocaleString() : "—"}</Td>
                    <Td className="font-medium">
                      {ddp.unit_price_jpy ? `¥${Number(ddp.unit_price_jpy).toLocaleString()}` : "—"}
                    </Td>
                    <Td className="text-muted-foreground">
                      {ddp.total_revenue_jpy ? `¥${Number(ddp.total_revenue_jpy).toLocaleString()}` : "—"}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-0.5 justify-end">
                        {quotationId && (
                          <Link href={`/${locale}/quotes/${quotationId}/ddp-calc`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <DeleteButton endpoint={`/api/ddp-calc?id=${ddp.id}`} label="this DDP calculation" />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── Customer Quotes ─────────────────────────────────────────── */}
        {activeTab === "customer-quote" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <Th>WO #</Th>
                <Th>Company</Th>
                <Th>Quote #</Th>
                <Th>Customer</Th>
                <Th>Date Sent</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No customer quotes yet</td></tr>
              )}
              {rows.map((cq) => {
                const wo = cq.quotations?.work_orders;
                const quotationId = cq.quotation_id;
                return (
                  <tr key={cq.id} className="hover:bg-muted/30 transition-colors">
                    <Td><span className="font-mono font-semibold text-blue-700">{wo?.wo_number ?? "—"}</span></Td>
                    <Td className="font-medium">{wo?.company_name ?? "—"}</Td>
                    <Td className="font-mono text-xs">{cq.winhoop_quote_number ?? "—"}</Td>
                    <Td className="text-muted-foreground">{cq.customer_name ?? "—"}</Td>
                    <Td className="text-muted-foreground">
                      {cq.date_sent ? new Date(cq.date_sent).toLocaleDateString() : "—"}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-0.5 justify-end">
                        {quotationId && (
                          <Link href={`/${locale}/quotes/${quotationId}/customer-quote`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <DeleteButton endpoint={`/api/customer-quotes?id=${cq.id}`} label={`customer quote ${cq.winhoop_quote_number ?? ""}`} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
