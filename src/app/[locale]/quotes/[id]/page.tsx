import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Circle, Clock, ChevronRight, AlertCircle, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AuditTrail from "@/components/quotes/AuditTrail";

type QuoteStatus =
  | "draft"
  | "pending_factory"
  | "pending_wilfred"
  | "pending_natsuki"
  | "sent"
  | "approved"
  | "rejected";

const STATUS_ORDER: QuoteStatus[] = [
  "pending_factory",
  "pending_wilfred",
  "pending_natsuki",
  "sent",
  "approved",
];

function getStepState(stepStatus: QuoteStatus, currentStatus: QuoteStatus): "done" | "current" | "upcoming" {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const stepIdx = STATUS_ORDER.indexOf(stepStatus);
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "current";
  return "upcoming";
}

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

  const factorySheetId = hasFactorySheet ? factorySheets[0]?.id : null;

  const currentStatus = quote.status as QuoteStatus;

  const steps = [
    {
      status: "pending_factory" as QuoteStatus,
      label: "Factory Cost Sheet",
      sublabel: "Annie enters costs from factory",
      href: `/${locale}/quotes/${id}/factory-sheet`,
      done: hasFactorySheet,
    },
    {
      status: "pending_wilfred" as QuoteStatus,
      label: "Wilfred Cost Calc",
      sublabel: "Add labour, accessories, overhead + margin",
      href: `/${locale}/quotes/${id}/cost-calc`,
      done: hasWilfredCalc,
    },
    {
      status: "pending_natsuki" as QuoteStatus,
      label: "DDP Calculation",
      sublabel: "Natsuki sets final Japan selling price",
      href: `/${locale}/quotes/${id}/ddp-calc`,
      done: hasDDPCalc,
    },
    {
      status: "sent" as QuoteStatus,
      label: "Customer Quote (お見積書)",
      sublabel: "Generate Japanese quote document",
      href: `/${locale}/quotes/${id}/customer-quote`,
      done: hasCustomerQuote,
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
        <div className="col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Progress</h3>
          {steps.map((step, i) => {
            const state = step.done ? "done" : getStepState(step.status, currentStatus);
            const isAccessible = step.done || state === "current";
            return (
              <div key={step.status} className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                state === "current"
                  ? "border-blue-200 bg-blue-50"
                  : state === "done"
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 bg-gray-50 opacity-60"
              }`}>
                <div className="flex-shrink-0">
                  {state === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : state === "current" ? (
                    <Clock className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${state === "done" ? "text-green-800" : state === "current" ? "text-blue-800" : "text-gray-500"}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{step.sublabel}</p>
                </div>
                {isAccessible && (
                  <Link href={step.href}>
                    <Button size="sm" variant={state === "current" ? "default" : "outline"} className="gap-1 flex-shrink-0">
                      {state === "done" ? "View" : "Start"}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Spec summary — right 1/3 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Spec Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
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
            </CardContent>
          </Card>

          {/* Quantity tiers */}
          {tiers.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{t("quantityTiers")}</CardTitle></CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          {/* Printing */}
          {(quote.printing_lid || quote.printing_body || quote.printing_bottom || quote.printing_inner) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{t("printing")}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {quote.printing_lid && <div><span className="text-gray-400">{t("printing_lid")}: </span><span>{quote.printing_lid}</span></div>}
                {quote.printing_body && <div><span className="text-gray-400">{t("printing_body")}: </span><span>{quote.printing_body}</span></div>}
                {quote.printing_bottom && <div><span className="text-gray-400">{t("printing_bottom")}: </span><span>{quote.printing_bottom}</span></div>}
                {quote.printing_inner && <div><span className="text-gray-400">{t("printing_inner")}: </span><span>{quote.printing_inner}</span></div>}
              </CardContent>
            </Card>
          )}

          {quote.internal_notes && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-700">Internal Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{quote.internal_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          {Array.isArray(quote.attachments) && quote.attachments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                  Attachments
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
