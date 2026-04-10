import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending_factory: "default",
  pending_wilfred: "default",
  pending_natsuki: "default",
  sent: "outline",
  approved: "outline",
  rejected: "destructive",
};

export default async function QuotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("quotes");
  const tc = await getTranslations("common");
  const tw = await getTranslations("workorders");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quotations } = await (supabase as any)
    .from("quotations")
    .select("*, work_orders(wo_number, company_name, project_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{quotations?.length ?? 0} {tc("total")}</p>
        </div>
        <Link href={`/${locale}/workorders`}>
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            {t("new")}
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tw("woNumber")}</TableHead>
              <TableHead>{tw("company")}</TableHead>
              <TableHead>{tw("project")}</TableHead>
              <TableHead>{t("version")}</TableHead>
              <TableHead>{tc("status")}</TableHead>
              <TableHead>{tc("deadline")}</TableHead>
              <TableHead className="w-20">{tc("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {quotations?.map((q: any) => {
              const wo = q.work_orders as { wo_number: string; company_name: string; project_name: string } | null;
              return (
                <TableRow key={q.id}>
                  <TableCell className="font-mono font-semibold text-blue-700">
                    {wo?.wo_number ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{wo?.company_name ?? "—"}</TableCell>
                  <TableCell className="text-gray-600">{wo?.project_name ?? "—"}</TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">{t("version")} {q.quote_version}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[q.status]}>
                      {t(`statuses.${q.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {q.deadline ? new Date(q.deadline).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/${locale}/quotes/${q.id}`}>
                      <Button variant="ghost" size="sm">{tc("view")}</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {!quotations?.length && (
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
