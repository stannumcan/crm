import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CreditCard, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Subscription = {
  id: string;
  service_name: string;
  vendor: string | null;
  category: string | null;
  cost_amount: number;
  cost_currency: string;
  billing_cycle: string;
  next_renewal_on: string | null;
  auto_renew: boolean;
  status: string;
  payment_method: string | null;
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export default async function SubscriptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("subscriptions");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("subscriptions")
    .select("id, service_name, vendor, category, cost_amount, cost_currency, billing_cycle, next_renewal_on, auto_renew, status, payment_method")
    .order("next_renewal_on", { ascending: true, nullsFirst: false });

  const subs: Subscription[] = data ?? [];
  const active = subs.filter((s) => s.status === "active");
  const renewingSoon = active.filter((s) => {
    const d = daysUntil(s.next_renewal_on);
    return d !== null && d >= 0 && d <= 30;
  });

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {active.length} {t("activeCount")}
          </p>
        </div>
        <Link href={`/${locale}/subscriptions/new`}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("new")}
          </Button>
        </Link>
      </div>

      {renewingSoon.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 text-sm">
                {t("renewingBanner", { count: renewingSoon.length })}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {renewingSoon.map((s) => {
                  const d = daysUntil(s.next_renewal_on);
                  return (
                    <li key={s.id}>
                      <Link href={`/${locale}/subscriptions/${s.id}/edit`} className="hover:underline font-medium">
                        {s.service_name}
                      </Link>
                      {" — "}
                      <span className="tabular-nums">{formatMoney(s.cost_amount, s.cost_currency)}</span>
                      {" · "}
                      <span>{d === 0 ? t("today") : d === 1 ? t("tomorrow") : t("inNDays", { n: d ?? 0 })}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("service")}</TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead className="text-right">{t("cost")}</TableHead>
              <TableHead>{t("cycle")}</TableHead>
              <TableHead>{t("nextRenewal")}</TableHead>
              <TableHead>{tc("status")}</TableHead>
              <TableHead className="w-20">{tc("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subs.map((s) => {
              const d = daysUntil(s.next_renewal_on);
              const soon = s.status === "active" && d !== null && d >= 0 && d <= 30;
              return (
                <TableRow key={s.id} className={s.status === "canceled" ? "opacity-50" : ""}>
                  <TableCell>
                    <Link href={`/${locale}/subscriptions/${s.id}/edit`} className="font-medium hover:underline text-blue-700">
                      {s.service_name}
                    </Link>
                    {s.vendor && <div className="text-xs text-gray-500 mt-0.5">{s.vendor}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{s.category ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-mono text-sm">
                    {formatMoney(s.cost_amount, s.cost_currency)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{t(`cycle_${s.billing_cycle}`)}</TableCell>
                  <TableCell className={"text-sm tabular-nums " + (soon ? "text-amber-700 font-semibold" : "text-gray-600")}>
                    {s.next_renewal_on ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      s.status === "active" ? "text-green-700 border-green-200 bg-green-50" :
                      s.status === "trial" ? "text-blue-700 border-blue-200 bg-blue-50" :
                      "text-gray-500 border-gray-200"
                    }>
                      {t(`status_${s.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/${locale}/subscriptions/${s.id}/edit`}>
                      <Button variant="ghost" size="sm">{tc("edit")}</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {!subs.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-sm">{t("empty")}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
