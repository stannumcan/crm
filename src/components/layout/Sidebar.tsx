"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, ClipboardList, Building2, Settings, Package, LogOut, FlaskConical, X, Home, CreditCard, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/lib/permissions-context";
import { useDivision } from "@/lib/division-context";
import type { PageKey } from "@/lib/permissions";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
];

export default function Sidebar({ locale }: { locale: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const { canView, isAdmin, testProfileId, testProfileName, setTestProfile, allProfiles } = usePermissions();
  const {
    accessible_divisions,
    active_division,
    is_super_admin,
    switchDivision,
  } = useDivision();

  // Branding adapts to active division. Super-admin in combined view shows
  // "All Divisions". Single-division users see their division's name.
  const brandName = active_division?.name?.toUpperCase() ?? (is_super_admin ? "ALL DIVISIONS" : "WINHOOP");
  const brandLetter = active_division?.code?.[0] ?? (is_super_admin ? "★" : "W");

  // Show the switcher only when there's actually a choice to make
  const showDivisionSwitcher =
    accessible_divisions.length > 1 || is_super_admin;

  // Dashboard is always visible to authenticated users — no permission gate needed.
  const dashboardItem = { href: `/${locale}`, label: t("dashboard"), icon: Home };

  const allNavItems: { href: string; label: string; icon: React.ElementType; pageKey: PageKey }[] = [
    { href: `/${locale}/workorders`, label: t("workorders"), icon: ClipboardList, pageKey: "workorders" },
    { href: `/${locale}/quotes`,     label: t("quotes"),     icon: FileText,      pageKey: "quotes_requests" },
    { href: `/${locale}/companies`,  label: t("companies"),  icon: Building2,     pageKey: "customers" },
    { href: `/${locale}/sales`,      label: t("sales"),      icon: Target,        pageKey: "sales_pipeline" },
    { href: `/${locale}/products`,   label: t("products"),   icon: Package,       pageKey: "products" },
    { href: `/${locale}/subscriptions`, label: t("subscriptions"), icon: CreditCard, pageKey: "subscriptions" },
    { href: `/${locale}/settings`,   label: t("settings"),   icon: Settings,      pageKey: "settings" },
  ];

  // Filter nav items based on permissions
  const navItems = allNavItems.filter((item) => canView(item.pageKey));

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    return segments.join("/");
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className="w-56 flex-col shrink-0 hidden md:flex"
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
          <div
            className="w-5 h-5 rounded-sm shrink-0 flex items-center justify-center"
            style={{ background: "var(--primary)" }}
          >
            <span
              className="text-white leading-none select-none"
              style={{ fontSize: "9px", fontFamily: "var(--font-display), Georgia, serif", fontWeight: 700 }}
            >
              {brandLetter}
            </span>
          </div>
          <span
            className="tracking-wide text-sm font-semibold"
            style={{ color: "var(--sidebar-foreground)", letterSpacing: "0.08em" }}
          >
            {brandName}
          </span>
        </div>
        <p
          className="text-xs mt-0.5 ml-7"
          style={{ color: "oklch(0.45 0.01 52)", letterSpacing: "0.04em" }}
        >
          Sales CRM
        </p>
      </div>

      {/* Division switcher (only when user has more than one division
          OR is super-admin with the "All" combined option) */}
      {showDivisionSwitcher && (
        <div
          className="px-3 py-2"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <p
            className="mb-1 px-1 uppercase"
            style={{ color: "oklch(0.40 0.01 52)", fontSize: "9px", letterSpacing: "0.14em" }}
          >
            Division
          </p>
          <select
            value={active_division?.id ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              switchDivision(v === "" ? null : v).then(() => router.refresh());
            }}
            className="w-full rounded text-xs px-2 py-1.5 border outline-none flex items-center gap-1.5"
            style={{
              background: "var(--sidebar-accent)",
              borderColor: "var(--sidebar-border)",
              color: "var(--sidebar-foreground)",
            }}
          >
            {is_super_admin && <option value="">★ All Divisions (combined)</option>}
            {accessible_divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Test profile banner */}
      {isAdmin && testProfileId && (
        <div
          className="flex items-center justify-between px-3 py-1.5 text-xs"
          style={{ background: "oklch(0.97 0.08 85)", borderBottom: "1px solid oklch(0.88 0.10 85)" }}
        >
          <span style={{ color: "oklch(0.45 0.12 85)" }}>
            <FlaskConical className="inline h-3 w-3 mr-1 -mt-0.5" />
            {testProfileName}
          </span>
          <button
            onClick={() => setTestProfile(null)}
            style={{ color: "oklch(0.50 0.12 85)" }}
            title="Exit test mode"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {/* Dashboard — always visible, highlighted only when exactly on the locale root */}
        {(() => {
          const Icon = dashboardItem.icon;
          const active = pathname === dashboardItem.href || pathname === `${dashboardItem.href}/`;
          return (
            <Link
              href={dashboardItem.href}
              className="group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150"
              style={{
                background: active ? "var(--primary)" : "transparent",
                color: active ? "#fff" : "var(--sidebar-foreground)",
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-accent)"; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span
                className="tabular-nums shrink-0 w-4 text-right"
                style={{ fontFamily: "var(--font-mono)", color: active ? "rgba(255,255,255,0.55)" : "oklch(0.40 0.01 52)", fontSize: "10px" }}
              >
                00
              </span>
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ opacity: active ? 1 : 0.65 }} />
              <span style={{ fontSize: "13px", letterSpacing: "0.01em" }}>{dashboardItem.label}</span>
            </Link>
          );
        })()}

        {navItems.map(({ href, label, icon: Icon }, idx) => {
          // Active check must exclude the dashboard prefix match — everything under locale
          // starts with the dashboard href, so use exact/segment match for non-dashboard links.
          const active = pathname === href || pathname.startsWith(href + "/");
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

      {/* Profile switcher (admin only) */}
      {isAdmin && (
        <div
          className="px-3 pb-3"
          style={{ borderTop: "1px solid var(--sidebar-border)", paddingTop: "10px" }}
        >
          <p
            className="mb-1.5 uppercase"
            style={{ color: "oklch(0.40 0.01 52)", fontSize: "9px", letterSpacing: "0.14em" }}
          >
            Test Profile
          </p>
          <select
            value={testProfileId ?? ""}
            onChange={(e) => setTestProfile(e.target.value || null)}
            className="w-full rounded text-xs px-2 py-1.5 border outline-none"
            style={{
              background: "var(--sidebar-accent)",
              borderColor: "var(--sidebar-border)",
              color: "var(--sidebar-foreground)",
            }}
          >
            <option value="">— My real permissions —</option>
            {allProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Logout */}
      <div className="px-3 pb-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150"
          style={{ color: "oklch(0.45 0.01 52)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--sidebar-accent)";
            (e.currentTarget as HTMLElement).style.color = "var(--sidebar-foreground)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "oklch(0.45 0.01 52)";
          }}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span style={{ fontSize: "13px", letterSpacing: "0.01em" }}>Sign out</span>
        </button>
      </div>

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
