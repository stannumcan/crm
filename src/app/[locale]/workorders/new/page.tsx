import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import WOForm from "@/components/workorders/WOForm";

export default async function NewWorkOrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("workorders");
  const tc = await getTranslations("common");

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/workorders`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("new")}</h1>
      </div>
      <WOForm locale={locale} />
    </div>
  );
}
