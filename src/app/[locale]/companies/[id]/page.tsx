import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, Globe, Phone, Mail, MapPin, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ContactsPanel from "@/components/companies/ContactsPanel";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("companies");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (supabase as any)
    .from("companies")
    .select("*, company_contacts(*)")
    .eq("id", id)
    .single();

  if (!company) notFound();

  const contacts = (company.company_contacts ?? []) as {
    id: string;
    name: string;
    name_ja: string | null;
    title: string | null;
    department: string | null;
    email: string | null;
    phone: string | null;
    phone_direct: string | null;
    is_primary: boolean;
    notes: string | null;
  }[];

  // Also fetch recent work orders for this company
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: workOrders } = await (supabase as any)
    .from("work_orders")
    .select("id, wo_number, project_name, status, created_at")
    .eq("company_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const address = [
    company.address_line1,
    company.address_line2,
    [company.city, company.prefecture].filter(Boolean).join(", "),
    company.postal_code,
    company.country,
  ].filter(Boolean).join("\n");

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/companies`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <Badge variant="outline" className="text-xs">{company.country}</Badge>
              {!company.is_active && <Badge variant="secondary">Inactive</Badge>}
            </div>
            {company.name_ja && <p className="text-gray-500">{company.name_ja}</p>}
            {company.name_zh && <p className="text-gray-400 text-sm">{company.name_zh}</p>}
            {company.industry && (
              <p className="text-sm text-blue-600 mt-1">{company.industry}</p>
            )}
          </div>
          <Link href={`/${locale}/companies/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Pencil className="h-3.5 w-3.5" />
              {tc("edit")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: address + contact info */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">{t("address")}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {address ? (
                <div className="flex gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <pre className="whitespace-pre-wrap font-sans text-gray-700">{address}</pre>
                </div>
              ) : (
                <p className="text-gray-400">No address on file</p>
              )}
              {company.region && (
                <p className="text-gray-500 text-xs">Region: {company.region}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">{t("contactInfo")}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {company.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-mono">{company.phone}</span>
                </div>
              )}
              {company.fax && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-mono text-gray-500">Fax: {company.fax}</span>
                </div>
              )}
              {company.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline">{company.email}</a>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-gray-400" />
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {!company.phone && !company.email && !company.website && (
                <p className="text-gray-400">No contact info on file</p>
              )}
            </CardContent>
          </Card>

          {company.notes && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{company.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Middle: contacts */}
        <div className="col-span-2 space-y-4">
          <ContactsPanel companyId={id} initialContacts={contacts} locale={locale} />

          {/* Work Orders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">Work Orders</CardTitle>
              <Link href={`/${locale}/workorders/new?company_id=${id}&company_name=${encodeURIComponent(company.name)}`}>
                <Button size="sm" variant="outline">+ New WO</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {workOrders?.length ? (
                <div className="space-y-2">
                  {workOrders.map((wo: { id: string; wo_number: string; project_name: string; status: string; created_at: string }) => (
                    <Link
                      key={wo.id}
                      href={`/${locale}/workorders/${wo.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <span className="font-mono font-semibold text-blue-700 text-sm">{wo.wo_number}</span>
                        <span className="text-gray-600 text-sm ml-3">{wo.project_name}</span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(wo.created_at).toLocaleDateString()}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Building2 className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No work orders yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
