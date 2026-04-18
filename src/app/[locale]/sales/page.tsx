import { createClient } from "@/lib/supabase/server";
import { getListDivisionFilter } from "@/lib/divisions-server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { CalendarDays, AlertTriangle, TrendingUp, Clock, Inbox } from "lucide-react";
import { getCurrentSeasonalFocus, STALE_THRESHOLD_DAYS, STALE_STAGES } from "@/lib/sales-constants";

export default async function SalesHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const divisionFilter = await getListDivisionFilter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const today = new Date().toISOString().split("T")[0];

  // Overdue follow-ups
  let overdueQ = sb
    .from("sales_activities")
    .select("id, type, subject, follow_up_date, company:companies(id, name)")
    .lt("follow_up_date", today)
    .not("follow_up_date", "is", null)
    .order("follow_up_date", { ascending: true })
    .limit(10);
  if (divisionFilter) overdueQ = overdueQ.eq("division_id", divisionFilter);
  const { data: overdue } = await overdueQ;

  // Actions due today
  let dueQ = sb
    .from("sales_deals")
    .select("id, stage, next_action, next_action_date, company:companies(id, name)")
    .eq("next_action_date", today)
    .limit(10);
  if (divisionFilter) dueQ = dueQ.eq("division_id", divisionFilter);
  const { data: dueToday } = await dueQ;

  // Pipeline summary
  let pipeQ = sb
    .from("sales_deals")
    .select("stage, estimated_value")
    .not("stage", "in", "(won,lost)");
  if (divisionFilter) pipeQ = pipeQ.eq("division_id", divisionFilter);
  const { data: pipelineRaw } = await pipeQ;

  const pipeline: Record<string, { count: number; value: number }> = {};
  for (const d of pipelineRaw ?? []) {
    if (!pipeline[d.stage]) pipeline[d.stage] = { count: 0, value: 0 };
    pipeline[d.stage].count++;
    pipeline[d.stage].value += Number(d.estimated_value ?? 0);
  }
  const totalActive = Object.values(pipeline).reduce((s, v) => s + v.count, 0);
  const totalValue = Object.values(pipeline).reduce((s, v) => s + v.value, 0);

  // Stale deals
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_THRESHOLD_DAYS);
  let staleQ = sb
    .from("sales_deals")
    .select("id, stage, updated_at, company:companies(id, name)")
    .in("stage", STALE_STAGES)
    .lt("updated_at", staleDate.toISOString())
    .order("updated_at", { ascending: true })
    .limit(5);
  if (divisionFilter) staleQ = staleQ.eq("division_id", divisionFilter);
  const { data: staleDeals } = await staleQ;

  // Pending enrichment count
  let pendingQ = sb
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("enrichment_status", "pending");
  if (divisionFilter) pendingQ = pendingQ.eq("division_id", divisionFilter);
  const { count: pendingCount } = await pendingQ;

  const seasonal = getCurrentSeasonalFocus();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sales Dashboard</h1>
        <div className="flex gap-2">
          <Link href={`/${locale}/sales/leads`} className="text-sm text-primary hover:underline">
            All Leads
          </Link>
          <Link href={`/${locale}/sales/pipeline`} className="text-sm text-primary hover:underline">
            Pipeline
          </Link>
        </div>
      </div>

      {/* Seasonal Focus */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4" />
            Seasonal Focus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{seasonal.season}</p>
          <p className="text-xs text-muted-foreground mt-1">{seasonal.focus}</p>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Active Deals</p>
            <p className="text-2xl font-bold">{totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pipeline Value</p>
            <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pending Enrichment</p>
            <p className="text-2xl font-bold">{pendingCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Overdue Follow-ups</p>
            <p className="text-2xl font-bold text-destructive">{overdue?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue follow-ups */}
      {(overdue?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-destructive">
              <Clock className="h-4 w-4" />
              Overdue Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdue!.map((a: { id: string; type: string; subject: string | null; follow_up_date: string; company: { id: string; name: string } | null }) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link href={`/${locale}/sales/leads/${a.company?.id}`} className="font-medium hover:underline">
                      {a.company?.name}
                    </Link>
                    <span className="text-muted-foreground ml-2">{a.type}: {a.subject || "—"}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs">{a.follow_up_date}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Due today */}
      {(dueToday?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Inbox className="h-4 w-4" />
              Actions Due Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dueToday!.map((d: { id: string; stage: string; next_action: string | null; company: { id: string; name: string } | null }) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link href={`/${locale}/sales/leads/${d.company?.id}`} className="font-medium hover:underline">
                      {d.company?.name}
                    </Link>
                    <Badge variant="outline" className="ml-2 text-xs">{d.stage}</Badge>
                  </div>
                  <span className="text-muted-foreground">{d.next_action || "—"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stale deals */}
      {(staleDeals?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Stale Deals ({`>${STALE_THRESHOLD_DAYS} days`})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {staleDeals!.map((d: { id: string; stage: string; updated_at: string; company: { id: string; name: string } | null }) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <Link href={`/${locale}/sales/leads/${d.company?.id}`} className="font-medium hover:underline">
                    {d.company?.name}
                  </Link>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">{d.stage}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {Math.round((Date.now() - new Date(d.updated_at).getTime()) / 86400000)}d ago
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline breakdown */}
      {Object.keys(pipeline).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Pipeline by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.entries(pipeline).map(([stage, info]) => (
                <div key={stage} className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{stage.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">
                    {info.count} deal{info.count !== 1 ? "s" : ""} &middot; ${info.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
