import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  completed: "outline",
  cancelled: "destructive",
};

export default async function WorkOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("workorders");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: workOrders } = await (supabase as any)
    .from("work_orders")
    .select("*, quotations(id)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{workOrders?.length ?? 0} {t("total")}</p>
        </div>
        <Link href={`/${locale}/workorders/new`}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("new")}
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("woNumber")}</TableHead>
              <TableHead>{t("company")}</TableHead>
              <TableHead>{t("project")}</TableHead>
              <TableHead>{t("quotes")}</TableHead>
              <TableHead>{tc("status")}</TableHead>
              <TableHead>{tc("date")}</TableHead>
              <TableHead className="w-20">{tc("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {workOrders?.map((wo: any) => (
              <TableRow key={wo.id}>
                <TableCell className="font-mono font-semibold text-blue-700">
                  {wo.wo_number}
                </TableCell>
                <TableCell className="font-medium">{wo.company_name}</TableCell>
                <TableCell className="text-gray-600">{wo.project_name}</TableCell>
                <TableCell>
                  <span className="text-sm text-gray-500">
                    {(wo.quotations as { id: string }[] | null)?.length ?? 0}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[wo.status]}>
                    {t(`statuses.${wo.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(wo.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Link href={`/${locale}/workorders/${wo.id}`}>
                    <Button variant="ghost" size="sm">{tc("view")}</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {!workOrders?.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
