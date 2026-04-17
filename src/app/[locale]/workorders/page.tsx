import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getListDivisionFilter } from "@/lib/divisions-server";
import WorkorderList from "@/components/workorders/WorkorderList";

export default async function WorkOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("workorders");

  const supabase = await createClient();
  const divFilter = await getListDivisionFilter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("work_orders")
    .select("id, wo_number, company_name, company_id, project_name, status, mould_flow, notes, created_at, updated_at, quotations(id)")
    .order("updated_at", { ascending: false });
  if (divFilter) query = query.eq("division_id", divFilter);
  const { data: workOrders } = await query;

  const rows = (workOrders ?? []).map((wo: {
    id: string; wo_number: string; company_name: string; company_id: string | null;
    project_name: string; status: string; mould_flow: string; notes: string | null;
    created_at: string; updated_at: string;
    quotations: { id: string }[] | null;
  }) => ({
    id: wo.id,
    wo_number: wo.wo_number,
    company_name: wo.company_name,
    company_id: wo.company_id,
    project_name: wo.project_name,
    status: wo.status,
    mould_flow: wo.mould_flow ?? "existing",
    quote_count: Array.isArray(wo.quotations) ? wo.quotations.length : 0,
    created_at: wo.created_at,
    updated_at: wo.updated_at,
  }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rows.length} {t("total")}</p>
        </div>
        <Link href={`/${locale}/workorders/new`}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("new")}
          </Button>
        </Link>
      </div>

      <WorkorderList rows={rows} locale={locale} />
    </div>
  );
}
