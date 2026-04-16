import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import SubscriptionForm, { type SubscriptionInitial } from "@/components/subscriptions/SubscriptionForm";
import { createClient } from "@/lib/supabase/server";

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("subscriptions");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/subscriptions`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{data.service_name}</h1>
      </div>

      <SubscriptionForm locale={locale} initial={data as SubscriptionInitial} />
    </div>
  );
}
