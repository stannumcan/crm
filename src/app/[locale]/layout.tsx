import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Sidebar from "@/components/layout/Sidebar";

type Locale = "en" | "ja" | "zh";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="flex h-screen bg-background">
        <Sidebar locale={locale} />
        <main className="flex-1 overflow-auto page-enter">
          {children}
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
