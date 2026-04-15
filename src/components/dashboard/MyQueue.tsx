"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle, ArrowRight, Clock, Factory, Calculator,
  Truck, FileSignature, Inbox, CheckCircle2,
} from "lucide-react";
import { usePermissions } from "@/lib/permissions-context";
import type { PageKey } from "@/lib/permissions";

export interface DashboardQuote {
  id: string;
  status: string;
  updated_at: string;
  pricing_changed: boolean;
  wo_number: string | null;
  company_name: string | null;
  project_name: string | null;
  urgency: boolean;
}

// Each workflow status maps to the pageKey the user needs edit on
const STATUS_ACTION: Record<string, {
  pageKey: PageKey;
  label: string;
  icon: React.ElementType;
  route: (locale: string, id: string) => string;
}> = {
  pending_factory:  { pageKey: "quotes_factory_sheet",  label: "Factory Cost Sheet", icon: Factory,       route: (l, id) => `/${l}/quotes/${id}/factory-sheet` },
  pending_wilfred:  { pageKey: "quotes_wilfred_calc",   label: "Cost Calc",          icon: Calculator,    route: (l, id) => `/${l}/quotes/${id}/cost-calc` },
  pending_natsuki:  { pageKey: "quotes_ddp_calc",       label: "DDP Calculation",    icon: Truck,         route: (l, id) => `/${l}/quotes/${id}/ddp-calc` },
  sent:             { pageKey: "quotes_customer_quote", label: "Customer Quote",     icon: FileSignature, route: (l, id) => `/${l}/quotes/${id}/customer-quote` },
};

function daysAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export default function MyQueue({ quotes, locale }: { quotes: DashboardQuote[]; locale: string }) {
  const { canEdit, loading } = usePermissions();

  if (loading) {
    return <div className="p-6" aria-busy="true" />;
  }

  // Quotes waiting on this user = quotes whose current status maps to a pageKey the user has edit permission on.
  const myQueue = quotes.filter((q) => {
    const action = STATUS_ACTION[q.status];
    if (!action) return false;
    return canEdit(action.pageKey);
  });

  const pricingAlerts = quotes.filter((q) => q.pricing_changed);

  // Recent activity: 5 most recently updated (not gated — shows what user can see by RLS)
  const recent = [...quotes]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Pricing alerts — high priority banner */}
      {pricingAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              Pricing Changed — {pricingAlerts.length} quote{pricingAlerts.length > 1 ? "s" : ""} affected
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1 space-y-1.5">
            {pricingAlerts.slice(0, 3).map((q) => (
              <Link
                key={q.id}
                href={`/${locale}/quotes/${q.id}`}
                className="flex items-center justify-between rounded-md px-3 py-2 bg-white border border-red-100 hover:border-red-300 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-semibold text-red-700">{q.wo_number ?? "—"}</span>
                  <span className="text-sm truncate">{q.project_name ?? "—"} · {q.company_name ?? "—"}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-red-600 shrink-0" />
              </Link>
            ))}
            {pricingAlerts.length > 3 && (
              <p className="text-xs text-red-700 pt-1">
                +{pricingAlerts.length - 3} more — <Link href={`/${locale}/quotes`} className="underline">view all</Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* My queue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Waiting on you
            {myQueue.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">{myQueue.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myQueue.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500/60 mb-2" />
              <p className="text-sm font-medium text-foreground">All clear</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nothing is waiting on you right now. New assignments will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {myQueue.map((q) => {
                const action = STATUS_ACTION[q.status];
                if (!action) return null;
                const Icon = action.icon;
                return (
                  <Link
                    key={q.id}
                    href={action.route(locale, q.id)}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all px-4 py-3 group"
                  >
                    <div className="rounded-md bg-blue-50 p-2 shrink-0">
                      <Icon className="h-4 w-4 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-semibold text-blue-700">{q.wo_number ?? "—"}</span>
                        {q.urgency && <Badge variant="destructive" className="text-[10px] h-4">URGENT</Badge>}
                        <span className="text-[10px] text-muted-foreground">· {action.label}</span>
                      </div>
                      <p className="text-sm truncate text-foreground">
                        {q.project_name ?? "—"} <span className="text-muted-foreground">· {q.company_name ?? "—"}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> updated {daysAgo(q.updated_at)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent activity
              </CardTitle>
              <Link href={`/${locale}/quotes`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {recent.map((q) => {
                const action = STATUS_ACTION[q.status];
                const ActionIcon = action?.icon;
                return (
                  <Link
                    key={q.id}
                    href={`/${locale}/quotes/${q.id}`}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-sm"
                  >
                    <span className="font-mono text-xs font-medium text-muted-foreground w-20 shrink-0">{q.wo_number ?? "—"}</span>
                    <span className="flex-1 truncate">{q.project_name ?? "—"} · {q.company_name ?? "—"}</span>
                    {ActionIcon && <ActionIcon className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <span className="text-[10px] text-muted-foreground shrink-0">{daysAgo(q.updated_at)}</span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
