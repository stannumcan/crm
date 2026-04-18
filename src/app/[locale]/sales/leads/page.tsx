import { createClient } from "@/lib/supabase/server";
import { getListDivisionFilter } from "@/lib/divisions-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Plus } from "lucide-react";
import { LeadScoreBadge } from "@/components/sales/LeadScoreBadge";
import { EnrichmentStatusBadge } from "@/components/sales/EnrichmentStatusBadge";

export default async function LeadsListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const divisionFilter = await getListDivisionFilter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("companies")
    .select("id, name, domain, industry, lead_source, relevancy_score, enrichment_status, employee_count, created_at")
    .neq("enrichment_status", "none")
    .order("created_at", { ascending: false });

  if (divisionFilter) query = query.eq("division_id", divisionFilter);

  const { data } = await query;
  const leads = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Leads</h1>
          <p className="text-sm text-muted-foreground">{leads.length} lead{leads.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href={`/${locale}/sales/leads/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Lead
          </Button>
        </Link>
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No leads yet. Add a company as a sales lead to get started.
        </p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead: {
                id: string;
                name: string;
                domain: string | null;
                industry: string | null;
                lead_source: string | null;
                relevancy_score: number | null;
                enrichment_status: string;
              }) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link
                      href={`/${locale}/sales/leads/${lead.id}`}
                      className="font-medium hover:underline"
                    >
                      {lead.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{lead.domain || "—"}</TableCell>
                  <TableCell className="text-sm">{lead.industry || "—"}</TableCell>
                  <TableCell>
                    {lead.lead_source && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {lead.lead_source}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <LeadScoreBadge score={lead.relevancy_score} />
                  </TableCell>
                  <TableCell>
                    <EnrichmentStatusBadge status={lead.enrichment_status} />
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
