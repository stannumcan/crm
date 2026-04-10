import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function CompaniesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("companies");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companies } = await (supabase as any)
    .from("companies")
    .select("id, name, name_ja, country, city, prefecture, phone, is_active, company_contacts(id, name, is_primary)")
    .order("name");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {companies?.filter((c: { is_active: boolean }) => c.is_active).length ?? 0} {t("active")}
          </p>
        </div>
        <Link href={`/${locale}/companies/new`}>
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
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("nameJa")}</TableHead>
              <TableHead>{tc("country")}</TableHead>
              <TableHead>{t("location")}</TableHead>
              <TableHead>{t("primaryContact")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead className="w-20">{tc("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {companies?.map((c: any) => {
              const primaryContact = c.company_contacts?.find((ct: { is_primary: boolean; name: string }) => ct.is_primary);
              return (
                <TableRow key={c.id} className={!c.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    <Link href={`/${locale}/companies/${c.id}`} className="hover:underline text-blue-700">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-500">{c.name_ja ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{c.country}</Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {[c.city, c.prefecture].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{primaryContact?.name ?? "—"}</TableCell>
                  <TableCell className="text-gray-500 text-sm font-mono">{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={`/${locale}/companies/${c.id}`}>
                      <Button variant="ghost" size="sm">{tc("view")}</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {!companies?.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-sm">{t("empty")}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
