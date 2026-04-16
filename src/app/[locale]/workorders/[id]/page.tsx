import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import WorkorderNotes from "@/components/workorders/WorkorderNotes";
import WorkorderTimeline from "@/components/workorders/WorkorderTimeline";
import MouldFlowSelector from "@/components/workorders/MouldFlowSelector";

const QUOTE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending_factory: "default",
  pending_wilfred: "default",
  pending_natsuki: "default",
  sent: "outline",
  approved: "outline",
  rejected: "destructive",
};

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("workorders");
  const tq = await getTranslations("quotes");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wo } = await (supabase as any)
    .from("work_orders")
    .select("*, quotations(*, quotation_quantity_tiers(*))")
    .eq("id", id)
    .single();

  if (!wo) notFound();

  const quotations = (wo.quotations as {
    id: string;
    quote_version: number;
    status: string;
    urgency: boolean;
    deadline: string | null;
    mold_number: string | null;
    created_at: string;
  }[] | null) ?? [];

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/workorders`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
      </div>

      {/* WO Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-mono font-bold text-blue-700">{wo.wo_number}</span>
              <Badge variant={wo.status === "active" ? "default" : "secondary"}>
                {t(`statuses.${wo.status}`)}
              </Badge>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{wo.project_name}</h2>
            <p className="text-gray-500 mt-1">{wo.company_name}</p>
          </div>
          <div className="text-sm text-gray-400">
            {new Date(wo.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Timeline — left 2/3 */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Progress</h3>
            <MouldFlowSelector workorderId={wo.id} currentFlow={wo.mould_flow as string ?? "existing"} />
          </div>
          <WorkorderTimeline workorderId={wo.id} />
        </div>

        {/* Sidebar — right 1/3 (sticky so it stays visible) */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-6">
            <WorkorderNotes workorderId={wo.id} initialNotes={(wo.notes as string | null) ?? null} />
          </div>
        </div>
      </div>

      {/* Quotations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{tq("title")}</CardTitle>
          <Link href={`/${locale}/quotes/new?wo_id=${wo.id}&wo_number=${wo.wo_number}`}>
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              {tq("new")}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {quotations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{tq("empty")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {quotations.map((q) => (
                <Link
                  key={q.id}
                  href={`/${locale}/quotes/${q.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-900">
                      {tq("version")} {q.quote_version}
                    </span>
                    {q.urgency && (
                      <Badge variant="destructive" className="text-xs">URGENT</Badge>
                    )}
                    {q.mold_number && (
                      <span className="text-sm text-gray-500 font-mono">{q.mold_number}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {q.deadline && (
                      <span className="text-xs text-gray-400">
                        {tc("deadline")}: {new Date(q.deadline).toLocaleDateString()}
                      </span>
                    )}
                    <Badge variant={QUOTE_STATUS_VARIANT[q.status]}>
                      {tq(`statuses.${q.status}`)}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
