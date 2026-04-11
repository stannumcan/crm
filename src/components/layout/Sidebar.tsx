"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, ClipboardList, Building2, Settings, Package } from "lucide-react";
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
    { href: `/${locale}/quotes`,     label: t("quotes"),     icon: FileText },
    { href: `/${locale}/companies`,  label: t("companies"),  icon: Building2 },
    { href: `/${locale}/products`,   label: t("products"),   icon: Package },
    { href: `/${locale}/settings`,   label: t("settings"),   icon: Settings },
  ];

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    return segments.join("/");
  };

  return (
    <aside
      className="w-56 flex flex-col shrink-0"
      style={{
        background: "var(--sidebar)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* Brand */}
      <div
        className="px-5 py-5"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-2.5 mb-0.5">
          {/* Vermillion seal motif */}
          <div
            className="w-5 h-5 rounded-sm shrink-0 flex items-center justify-center"
            style={{ background: "var(--primary)" }}
          >
            <span
              className="text-white leading-none select-none"
              style={{ fontSize: "9px", fontFamily: "var(--font-display), Georgia, serif", fontWeight: 700 }}
            >
              W
            </span>
          </div>
          <span
            className="tracking-wide text-sm font-semibold"
            style={{ color: "var(--sidebar-foreground)", letterSpacing: "0.08em" }}
          >
            WINHOOP
          </span>
        </div>
        <p
          className="text-xs mt-0.5 ml-7"
          style={{ color: "oklch(0.45 0.01 52)", letterSpacing: "0.04em" }}
        >
          Sales CRM
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }, idx) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150",
              )}
              style={{
                background: active ? "var(--primary)" : "transparent",
                color: active ? "#fff" : "var(--sidebar-foreground)",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-accent)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {/* Sequential index */}
              <span
                className="tabular-nums shrink-0 w-4 text-right"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: active ? "rgba(255,255,255,0.55)" : "oklch(0.40 0.01 52)",
                  fontSize: "10px",
                }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <Icon
                className="h-3.5 w-3.5 shrink-0"
                style={{ opacity: active ? 1 : 0.65 }}
              />
              <span style={{ fontSize: "13px", letterSpacing: "0.01em" }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Language switcher */}
      <div
        className="px-4 py-4"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        <p
          className="mb-2 uppercase"
          style={{ color: "oklch(0.40 0.01 52)", fontSize: "9px", letterSpacing: "0.14em" }}
        >
          Language
        </p>
        <div className="flex gap-1">
          {LOCALES.map(({ code, label }) => (
            <Link
              key={code}
              href={switchLocale(code)}
              className="flex-1 text-center py-1.5 rounded font-medium transition-all duration-150"
              style={
                locale === code
                  ? { background: "var(--primary)", color: "#fff", fontSize: "11px" }
                  : { background: "var(--sidebar-accent)", color: "var(--sidebar-foreground)", fontSize: "11px" }
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
