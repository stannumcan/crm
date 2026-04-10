import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CompanyForm from "@/components/companies/CompanyForm";

export default async function NewCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { locale } = await params;
  const { name } = await searchParams;
  const t = await getTranslations("companies");
  const tc = await getTranslations("common");

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/companies`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("new")}</h1>
      </div>

      {/* Pre-fill name if coming from WO form "Add new company" */}
      <CompanyForm locale={locale} initial={name ? { name } : undefined} />
    </div>
  );
}
