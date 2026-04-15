import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import MyQueue, { type DashboardQuote } from "@/components/dashboard/MyQueue";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, FileText, Building2, Package } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const supabase = await createClient();

  // Fetch active quotes the user can see (RLS filters automatically)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("quotations")
    .select(`
      id, status, updated_at, pricing_changed, urgency,
      work_orders(wo_number, company_name, project_name)
    `)
    .in("status", ["pending_factory", "pending_wilfred", "pending_natsuki", "sent", "draft"])
    .order("updated_at", { ascending: false });

  const quotes: DashboardQuote[] = (rows ?? []).map((q: {
    id: string; status: string; updated_at: string; pricing_changed: boolean | null; urgency: boolean | null;
    work_orders: { wo_number: string | null; company_name: string | null; project_name: string | null } | null;
  }) => ({
    id: q.id,
    status: q.status,
    updated_at: q.updated_at,
    pricing_changed: !!q.pricing_changed,
    urgency: !!q.urgency,
    wo_number: q.work_orders?.wo_number ?? null,
    company_name: q.work_orders?.company_name ?? null,
    project_name: q.work_orders?.project_name ?? null,
  }));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? t("greetingMorning") : hour < 18 ? t("greetingAfternoon") : t("greetingEvening");

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MyQueue quotes={quotes} locale={locale} />
        </div>

        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4 pb-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t("quickLinks")}</p>
              <QuickLink href={`/${locale}/workorders`} icon={ClipboardList} label={tn("workorders")} />
              <QuickLink href={`/${locale}/quotes`} icon={FileText} label={tn("quotes")} />
              <QuickLink href={`/${locale}/companies`} icon={Building2} label={tn("companies")} />
              <QuickLink href={`/${locale}/products`} icon={Package} label={tn("products")} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("activeQuotes")}</p>
              <p className="text-3xl font-bold tabular-nums">{quotes.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t("activeQuotesDesc")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm transition-colors group"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
      <span className="text-foreground">{label}</span>
    </Link>
  );
}
