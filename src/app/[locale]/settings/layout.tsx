import Link from "next/link";

const TABS = [
  { key: "users",    label: "Users",               suffix: "/users" },
  { key: "profiles", label: "Permission Profiles",  suffix: "/profiles" },
];

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const base = `/${locale}/settings`;

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 pt-6 pb-0">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
      </div>
      <div className="border-b border-border bg-background px-6">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab, i) => (
            <Link
              key={tab.key}
              href={base + tab.suffix}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <span className="font-mono text-[10px] opacity-50">{String(i + 1).padStart(2, "0")}</span>
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
