import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CollapsibleCard from "@/components/ui/collapsible-card";
import { ArrowLeft, CheckCircle2, AlertCircle, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AuditTrail from "@/components/quotes/AuditTrail";
import QuoteProgressSteps, { type ProgressStep } from "@/components/quotes/QuoteProgressSteps";

type QuoteStatus =
  | "draft"
  | "pending_factory"
  | "pending_wilfred"
  | "pending_natsuki"
  | "sent"
  | "approved"
  | "rejected";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending_factory: "default",
  pending_wilfred: "default",
  pending_natsuki: "default",
  sent: "outline",
  approved: "outline",
  rejected: "destructive",
};

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("quotes");
  const tc = await getTranslations("common");
  const tw = await getTranslations("workorders");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error: quoteError } = await (supabase as any)
    .from("quotations")
    .select(`
      *,
      work_orders(id, wo_number, company_name, project_name),
      quotation_quantity_tiers(*),
      factory_cost_sheets(id, wilfred_calculations(id)),
      natsuki_ddp_calculations!quotation_id(id),
      customer_quotes(id)
    `)
    .eq("id", id)
    .single();

  if (quoteError || !quote) notFound();

  // Look up the current workflow step's assignees so we can show "Waiting on: ..."
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentStep } = await (supabase as any)
    .from("workflow_steps")
    .select("assignee_emails")
    .eq("step_key", quote.status)
    .maybeSingle();

  const assigneeEmails = (currentStep?.assignee_emails as string[] | null) ?? [];
  let waitingOnNames: string[] = [];
  if (assigneeEmails.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profiles } = await (supabase as any)
      .from("user_profiles")
      .select("email, display_name")
      .in("email", assigneeEmails);
    waitingOnNames = (profiles as { email: string; display_name: string | null }[] | null ?? [])
      .map((p) => p.display_name || p.email)
      .filter(Boolean);
    // Fallback: any email without a profile row still shows as raw email
    for (const email of assigneeEmails) {
      if (!waitingOnNames.some((n) => n === email || (profiles as { email: string }[] | null ?? []).some((p) => p.email === email))) {
        waitingOnNames.push(email);
      }
    }
  }

  const wo = quote.work_orders as { id: string; wo_number: string; company_name: string; project_name: string } | null;
  const tiers = (quote.quotation_quantity_tiers as { id: string; tier_label: string; quantity_type: string; quantity: number | null; sort_order: number }[] | null) ?? [];

  // factory_cost_sheets is an array (one-to-many FK)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factorySheets = (Array.isArray(quote.factory_cost_sheets) ? quote.factory_cost_sheets : (quote.factory_cost_sheets ? [quote.factory_cost_sheets] : [])) as { id: string; wilfred_calculations: unknown }[];
  const hasFactorySheet = factorySheets.length > 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasWilfredCalc = factorySheets.some((fs: any) => Array.isArray(fs.wilfred_calculations) ? fs.wilfred_calculations.length > 0 : !!fs.wilfred_calculations);
  const hasDDPCalc = Array.isArray(quote.natsuki_ddp_calculations) ? quote.natsuki_ddp_calculations.length > 0 : !!quote.natsuki_ddp_calculations;
  const hasCustomerQuote = Array.isArray(quote.customer_quotes) ? quote.customer_quotes.length > 0 : !!quote.customer_quotes;

  const currentStatus = quote.status as QuoteStatus;

  const steps: ProgressStep[] = [
    {
      status: "draft",
      label: "Quote Request",
      sublabel: "Mold, printing, embossing, quantity tiers",
      href: `/${locale}/quotes/${id}/request`,
      done: true, // The quote exists, so the request step is by definition complete
      pageKey: "quotes_requests",
    },
    {
      status: "pending_factory",
      label: "Factory Cost Sheet",
      sublabel: "Annie enters costs from factory",
      href: `/${locale}/quotes/${id}/factory-sheet`,
      done: hasFactorySheet,
      pageKey: "quotes_factory_sheet",
    },
    {
      status: "pending_wilfred",
      label: "Cost Calc",
      sublabel: "Add labour, accessories, overhead + margin",
      href: `/${locale}/quotes/${id}/cost-calc`,
      done: hasWilfredCalc,
      pageKey: "quotes_wilfred_calc",
    },
    {
      status: "pending_natsuki",
      label: "DDP Calculation",
      sublabel: "Natsuki sets final Japan selling price",
      href: `/${locale}/quotes/${id}/ddp-calc`,
      done: hasDDPCalc,
      pageKey: "quotes_ddp_calc",
    },
    {
      status: "sent",
      label: "Customer Quote (お見積書)",
      sublabel: "Generate Japanese quote document",
      href: `/${locale}/quotes/${id}/customer-quote`,
      done: hasCustomerQuote,
      pageKey: "quotes_customer_quote",
    },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={wo ? `/${locale}/workorders/${wo.id}` : `/${locale}/quotes`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {wo && (
                <Link href={`/${locale}/workorders/${wo.id}`} className="text-2xl font-mono font-bold text-blue-700 hover:underline">
                  {wo.wo_number}
                </Link>
              )}
              <span className="text-gray-400 text-lg">·</span>
              <span className="text-lg font-medium text-gray-600">{t("version")} {quote.quote_version}</span>
              {quote.urgency && <Badge variant="destructive" className="text-xs">URGENT</Badge>}
            </div>
            {wo && (
              <>
                <h2 className="text-xl font-semibold text-gray-900">{wo.project_name}</h2>
                <p className="text-gray-500 mt-0.5">{wo.company_name}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <AuditTrail quotationId={id} />
            <Badge variant={STATUS_VARIANT[currentStatus]}>
              {t(`statuses.${currentStatus}`)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Step tracker — left 2/3 */}
        <div className="col-span-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Progress</h3>
          <QuoteProgressSteps
            steps={steps}
            currentStatus={currentStatus}
            waitingOnNames={waitingOnNames}
            waitingSince={quote.updated_at}
          />
        </div>

        {/* Spec summary — right 1/3 */}
        <div className="space-y-3">
          <CollapsibleCard title="Spec Summary" defaultOpen>
            <div className="space-y-2 text-sm">
              {quote.mold_number && (
                <div>
                  <span className="text-gray-500 text-xs">Mold</span>
                  <p className="font-mono font-medium">{quote.mold_number}</p>
                </div>
              )}
              {quote.size_dimensions && (
                <div>
                  <span className="text-gray-500 text-xs">Size</span>
                  <p>{quote.size_dimensions}</p>
                </div>
              )}
              {quote.deadline && (
                <div>
                  <span className="text-gray-500 text-xs">{tc("deadline")}</span>
                  <p>{new Date(quote.deadline).toLocaleDateString()}</p>
                </div>
              )}
              {quote.design_count && quote.design_count > 1 && (
                <div>
                  <span className="text-gray-500 text-xs">Designs</span>
                  <p>{quote.design_count}</p>
                </div>
              )}
              {quote.embossment && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-700 text-xs font-medium">Embossment</span>
                </div>
              )}
              {quote.shipping_info_required && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-blue-700 text-xs font-medium">Shipping info req.</span>
                </div>
              )}
            </div>
          </CollapsibleCard>

          {tiers.length > 0 && (
            <CollapsibleCard
              title={t("quantityTiers")}
              defaultOpen
              summary={`${tiers.length} tier${tiers.length > 1 ? "s" : ""}`}
            >
              <div className="space-y-2">
                {tiers.sort((a, b) => a.sort_order - b.sort_order).map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between">
                    <span className="flex items-center justify-center h-6 w-6 rounded text-xs font-bold bg-gray-100 text-gray-600">
                      {tier.tier_label}
                    </span>
                    <span className="text-sm text-gray-600">
                      {tier.quantity_type === "units"
                        ? (tier.quantity ? tier.quantity.toLocaleString() + " pcs" : "—")
                        : tier.quantity_type === "fcl_20ft" ? "20ft FCL"
                        : "40ft FCL"}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {(quote.printing_lid || quote.printing_body || quote.printing_bottom || quote.printing_inner) && (
            <CollapsibleCard title={t("printing")} defaultOpen={false}>
              <div className="space-y-1.5 text-xs">
                {quote.printing_lid && <div><span className="text-gray-400">{t("printing_lid")}: </span><span>{quote.printing_lid}</span></div>}
                {quote.printing_body && <div><span className="text-gray-400">{t("printing_body")}: </span><span>{quote.printing_body}</span></div>}
                {quote.printing_bottom && <div><span className="text-gray-400">{t("printing_bottom")}: </span><span>{quote.printing_bottom}</span></div>}
                {quote.printing_inner && <div><span className="text-gray-400">{t("printing_inner")}: </span><span>{quote.printing_inner}</span></div>}
              </div>
            </CollapsibleCard>
          )}

          {quote.internal_notes && (
            <CollapsibleCard
              title={<span className="text-amber-700">Internal Notes</span>}
              defaultOpen={false}
            >
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{quote.internal_notes}</p>
            </CollapsibleCard>
          )}

          {Array.isArray(quote.attachments) && quote.attachments.length > 0 && (
            <CollapsibleCard
              title={<span className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5 text-gray-400" />Attachments</span>}
              defaultOpen={false}
              summary={`${(quote.attachments as unknown[]).length}`}
            >
              <ul className="space-y-1.5">
                {(quote.attachments as { name: string; url: string; size: number; type: string }[]).map((f, i) => (
                  <li key={i}>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-700 hover:underline truncate"
                    >
                      <Paperclip className="h-3 w-3 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{f.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </CollapsibleCard>
          )}
        </div>
      </div>
    </div>
  );
}
