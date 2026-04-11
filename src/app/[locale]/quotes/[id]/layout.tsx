import QuoteSubNav from "@/components/quotes/QuoteSubNav";

export default async function QuoteDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const basePath = `/${locale}/quotes/${id}`;

  return (
    <div className="flex flex-col min-h-full">
      <QuoteSubNav basePath={basePath} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
