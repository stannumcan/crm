import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CompanyForm from "@/components/companies/CompanyForm";

export default async function EditCompanyPage({
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
    .select("*")
    .eq("id", id)
    .single();

  if (!company) notFound();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/companies/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit — {company.name}</h1>
      </div>

      <CompanyForm locale={locale} initial={company} />
    </div>
  );
}
