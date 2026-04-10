"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, ClipboardList, Building2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
];

export default function Sidebar({ locale }: { locale: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const navItems = [
    { href: `/${locale}/workorders`, label: t("workorders"), icon: ClipboardList },
    { href: `/${locale}/quotes`, label: t("quotes"), icon: FileText },
    { href: `/${locale}/companies`, label: t("companies"), icon: Building2 },
    { href: `/${locale}/settings`, label: t("settings"), icon: Settings },
  ];

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    return segments.join("/");
  };

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">Japan CRM</h1>
        <p className="text-xs text-gray-500 mt-0.5">Sales Management</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <p className="text-xs text-gray-400 mb-2 px-1">Language</p>
        <div className="flex gap-1">
          {LOCALES.map(({ code, label }) => (
            <Link
              key={code}
              href={switchLocale(code)}
              className={cn(
                "flex-1 text-center text-xs py-1.5 rounded border font-medium transition-colors",
                locale === code
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
