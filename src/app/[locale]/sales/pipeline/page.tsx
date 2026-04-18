import { createClient } from "@/lib/supabase/server";
import { getListDivisionFilter } from "@/lib/divisions-server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { PIPELINE_STAGES, ACTIVE_STAGES } from "@/lib/sales-constants";

interface Deal {
  id: string;
  stage: string;
  estimated_value: number | null;
  next_action: string | null;
  next_action_date: string | null;
  product_interest: string | null;
  company: { id: string; name: string } | null;
}

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const divisionFilter = await getListDivisionFilter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("sales_deals")
    .select("id, stage, estimated_value, next_action, next_action_date, product_interest, company:companies(id, name)")
    .order("updated_at", { ascending: false });

  if (divisionFilter) query = query.eq("division_id", divisionFilter);

  const { data } = await query;
  const deals: Deal[] = data ?? [];

  // Group by stage
  const grouped: Record<string, Deal[]> = {};
  for (const stage of PIPELINE_STAGES) {
    grouped[stage.value] = [];
  }
  for (const deal of deals) {
    if (!grouped[deal.stage]) grouped[deal.stage] = [];
    grouped[deal.stage].push(deal);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <Link href={`/${locale}/sales`} className="text-sm text-primary hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      {/* Kanban-style columns (horizontal scroll on mobile, grid on desktop) */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {ACTIVE_STAGES.map((stageValue) => {
          const stageDef = PIPELINE_STAGES.find((s) => s.value === stageValue);
          const stageDeals = grouped[stageValue] ?? [];
          const stageValue$ = stageDeals.reduce((sum, d) => sum + Number(d.estimated_value ?? 0), 0);

          return (
            <div key={stageValue} className="min-w-[220px] flex-shrink-0">
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium flex items-center justify-between">
                    <span>{stageDef?.label ?? stageValue}</span>
                    <Badge variant="outline" className="text-xs tabular-nums">{stageDeals.length}</Badge>
                  </CardTitle>
                  {stageValue$ > 0 && (
                    <p className="text-xs text-muted-foreground">${stageValue$.toLocaleString()}</p>
                  )}
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {stageDeals.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">Empty</p>
                  ) : (
                    stageDeals.map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/${locale}/sales/leads/${deal.company?.id}`}
                        className="block border rounded p-2 hover:bg-muted transition-colors"
                      >
                        <p className="text-sm font-medium truncate">{deal.company?.name}</p>
                        {deal.product_interest && (
                          <p className="text-xs text-muted-foreground truncate">{deal.product_interest}</p>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          {deal.estimated_value != null && (
                            <span className="text-xs font-medium">${Number(deal.estimated_value).toLocaleString()}</span>
                          )}
                          {deal.next_action_date && (
                            <span className="text-xs text-muted-foreground">{deal.next_action_date}</span>
                          )}
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Won / Lost / Nurture summary */}
      <div className="grid grid-cols-3 gap-3">
        {(["won", "lost", "nurture"] as const).map((stage) => {
          const stageDeals = grouped[stage] ?? [];
          const stageDef = PIPELINE_STAGES.find((s) => s.value === stage);
          return (
            <Card key={stage}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{stageDef?.label}</p>
                <p className="text-xl font-bold">{stageDeals.length}</p>
                {stageDeals.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ${stageDeals.reduce((s, d) => s + Number(d.estimated_value ?? 0), 0).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
