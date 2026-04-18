"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X, FileText, ClipboardList, Building2, Settings, Package, Home, Target } from "lucide-react";
import { usePermissions } from "@/lib/permissions-context";
import type { PageKey } from "@/lib/permissions";

// Mobile-only top bar + slide-out drawer. Sidebar stays hidden below md.
export default function MobileNav({ locale }: { locale: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { canView } = usePermissions();
  const [open, setOpen] = useState(false);

  const allNavItems: { href: string; label: string; icon: React.ElementType; pageKey?: PageKey }[] = [
    { href: `/${locale}`,            label: t("dashboard"),   icon: Home },
    { href: `/${locale}/workorders`, label: t("workorders"),  icon: ClipboardList, pageKey: "workorders" },
    { href: `/${locale}/quotes`,     label: t("quotes"),      icon: FileText,      pageKey: "quotes_requests" },
    { href: `/${locale}/companies`,  label: t("companies"),   icon: Building2,     pageKey: "customers" },
    { href: `/${locale}/sales`,      label: t("sales"),       icon: Target,        pageKey: "sales_pipeline" },
    { href: `/${locale}/products`,   label: t("products"),    icon: Package,       pageKey: "products" },
    { href: `/${locale}/settings`,   label: t("settings"),    icon: Settings,      pageKey: "settings" },
  ];
  const navItems = allNavItems.filter((it) => !it.pageKey || canView(it.pageKey));

  return (
    <>
      {/* Top bar — only on mobile */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-card sticky top-0 z-30">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-1 rounded-md hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold text-sm tracking-wide">WINHOOP</span>
      </div>

      {/* Drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 bg-card shadow-xl p-4 flex flex-col gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm tracking-wide">WINHOOP</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="p-1 rounded-md hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {navItems.map(({ href, label, icon: Icon }) => {
              const active = href === `/${locale}`
                ? pathname === href || pathname === `${href}/`
                : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  style={{
                    background: active ? "var(--primary)" : "transparent",
                    color: active ? "#fff" : "var(--foreground)",
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </aside>
        </div>
      )}
    </>
  );
}
