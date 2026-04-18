import { createClient } from "@/lib/supabase/server";
import { getListDivisionFilter } from "@/lib/divisions-server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

const ACTION_COLORS: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
  insert: "default",
  update: "secondary",
  delete: "destructive",
  revert: "outline",
};

export default async function SalesAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const divisionFilter = await getListDivisionFilter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("sales_audit_log")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(100);

  if (divisionFilter) query = query.eq("division_id", divisionFilter);

  const { data } = await query;
  const entries = data ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sales Audit Log</h1>
        <Link href={`/${locale}/sales`} className="text-sm text-primary hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No audit entries yet.</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Row ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e: {
                id: string;
                changed_at: string;
                table_name: string;
                action: string;
                row_id: string;
              }) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.changed_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm font-mono">{e.table_name}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_COLORS[e.action] ?? "outline"} className="text-xs">
                      {e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{e.row_id.slice(0, 8)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
