import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadScoreBadge } from "@/components/sales/LeadScoreBadge";
import { EnrichmentStatusBadge } from "@/components/sales/EnrichmentStatusBadge";
import { ActivityTimeline } from "@/components/sales/ActivityTimeline";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch company
  const { data: company, error } = await sb
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !company) return notFound();

  // Fetch related data in parallel
  const [contactsRes, dealsRes, activitiesRes, draftsRes, newsRes] = await Promise.all([
    sb.from("company_contacts").select("*").eq("company_id", id).order("is_primary", { ascending: false }),
    sb.from("sales_deals").select("*").eq("company_id", id).order("updated_at", { ascending: false }),
    sb.from("sales_activities").select("*, contact:company_contacts(name, title)").eq("company_id", id).order("created_at", { ascending: false }).limit(20),
    sb.from("sales_email_drafts").select("*, contact:company_contacts(name, title, email)").eq("company_id", id).order("created_at", { ascending: false }),
    sb.from("sales_company_news").select("*").eq("company_id", id).order("created_at", { ascending: false }),
  ]);

  const contacts = contactsRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const drafts = draftsRes.data ?? [];
  const news = newsRes.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/${locale}/sales/leads`} className="text-xs text-muted-foreground hover:underline">
            &larr; Back to Leads
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{company.name}</h1>
          {company.domain && <p className="text-sm text-muted-foreground">{company.domain}</p>}
        </div>
        <div className="flex items-center gap-2">
          <LeadScoreBadge score={company.relevancy_score} />
          <EnrichmentStatusBadge status={company.enrichment_status} />
        </div>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
            {company.industry && <><dt className="text-muted-foreground">Industry</dt><dd>{company.industry}</dd></>}
            {company.employee_count && <><dt className="text-muted-foreground">Employees</dt><dd>{company.employee_count.toLocaleString()}</dd></>}
            {company.lead_source && <><dt className="text-muted-foreground">Source</dt><dd className="capitalize">{company.lead_source}</dd></>}
            {company.country && <><dt className="text-muted-foreground">Country</dt><dd>{company.country}</dd></>}
            {company.website && <><dt className="text-muted-foreground">Website</dt><dd><a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{company.website}</a></dd></>}
          </dl>
          {company.description && <p className="text-sm mt-3 text-muted-foreground">{company.description}</p>}
          {company.relevancy_reason && (
            <p className="text-xs mt-2 text-muted-foreground italic">Score reason: {company.relevancy_reason}</p>
          )}
          {company.opportunity_notes && (
            <div className="mt-3 p-2 bg-muted rounded text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">Opportunity Notes</p>
              {company.opportunity_notes}
            </div>
          )}
          {company.current_packaging && (
            <div className="mt-2 p-2 bg-muted rounded text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">Current Packaging</p>
              {company.current_packaging}
            </div>
          )}
          {company.import_data_notes && (
            <div className="mt-2 p-2 bg-muted rounded text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">Import Data</p>
              {company.import_data_notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contacts ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>LinkedIn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c: { id: string; name: string; title: string | null; email: string | null; email_confidence: string | null; linkedin_url: string | null; is_primary: boolean }) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.name}
                      {c.is_primary && <Badge variant="default" className="ml-2 text-xs">Primary</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{c.title || "—"}</TableCell>
                    <TableCell className="text-sm">{c.email || "—"}</TableCell>
                    <TableCell>
                      {c.email_confidence && (
                        <Badge variant="outline" className="text-xs">{c.email_confidence}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          Profile
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Deals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Deals ({deals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals yet.</p>
          ) : (
            <div className="space-y-2">
              {deals.map((d: { id: string; stage: string; product_interest: string | null; estimated_value: number | null; next_action: string | null; next_action_date: string | null }) => (
                <div key={d.id} className="flex items-center justify-between text-sm border rounded p-2">
                  <div>
                    <Badge variant="outline" className="text-xs capitalize mr-2">{d.stage.replace(/_/g, " ")}</Badge>
                    {d.product_interest && <span>{d.product_interest}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs">
                    {d.estimated_value != null && <span>${Number(d.estimated_value).toLocaleString()}</span>}
                    {d.next_action && <span>{d.next_action}</span>}
                    {d.next_action_date && <Badge variant="secondary" className="text-xs">{d.next_action_date}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activities */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activities ({activities.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline activities={activities} />
        </CardContent>
      </Card>

      {/* Email Drafts */}
      {drafts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Email Drafts ({drafts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {drafts.map((d: { id: string; subject: string | null; status: string; ai_generated: boolean; created_at: string; contact: { name: string } | null }) => (
                <div key={d.id} className="border rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{d.subject || "(no subject)"}</span>
                    <Badge variant="outline" className="text-xs">{d.status}</Badge>
                    {d.ai_generated && <Badge variant="secondary" className="text-xs">AI</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.contact?.name && `To: ${d.contact.name} · `}
                    {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* News */}
      {news.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Research & News ({news.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {news.map((n: { id: string; headline: string; url: string | null; summary: string | null; published_date: string | null }) => (
                <div key={n.id} className="text-sm">
                  <p className="font-medium">
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{n.headline}</a>
                    ) : n.headline}
                  </p>
                  {n.summary && <p className="text-muted-foreground text-xs mt-0.5">{n.summary}</p>}
                  {n.published_date && <p className="text-xs text-muted-foreground">{n.published_date}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
