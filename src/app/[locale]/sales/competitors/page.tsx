import { createClient } from "@/lib/supabase/server";
import { getListDivisionFilter } from "@/lib/divisions-server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const divisionFilter = await getListDivisionFilter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("sales_competitors")
    .select("*")
    .order("mention_count", { ascending: false });

  if (divisionFilter) query = query.eq("division_id", divisionFilter);

  const { data } = await query;
  const competitors = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Competitors</h1>
          <p className="text-sm text-muted-foreground">{competitors.length} tracked</p>
        </div>
        <Link href={`/${locale}/sales`} className="text-sm text-primary hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      {competitors.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No competitors tracked yet. They appear here as Claude Code logs them during research.
        </p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Competitor</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Mentions</TableHead>
                <TableHead>Prospects</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.map((c: {
                id: string;
                name: string;
                country: string | null;
                mention_count: number;
                prospect_names: string | null;
                last_seen: string;
                notes: string | null;
              }, idx: number) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <span className="font-medium">{c.name}</span>
                    {c.notes && <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>}
                  </TableCell>
                  <TableCell>{c.country || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs tabular-nums">{c.mention_count}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {c.prospect_names || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(c.last_seen).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
