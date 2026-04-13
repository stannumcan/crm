"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/lib/permissions-context";
import type { PageKey } from "@/lib/permissions";

const ALL_TABS: { label: string; suffix: string; pageKey: PageKey | null }[] = [
  { label: "Overview",        suffix: "",                pageKey: "quotes_requests" },
  { label: "Quote Request",   suffix: "/request",        pageKey: "quotes_requests" },
  { label: "Factory Sheet",   suffix: "/factory-sheet",  pageKey: "quotes_factory_sheet" },
  { label: "Cost Calc",       suffix: "/cost-calc",      pageKey: "quotes_wilfred_calc" },
  { label: "DDP Calc",        suffix: "/ddp-calc",       pageKey: "quotes_ddp_calc" },
  { label: "Customer Quote",  suffix: "/customer-quote", pageKey: "quotes_customer_quote" },
];

export default function QuoteSubNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const { canView } = usePermissions();

  const tabs = ALL_TABS.filter((t) => t.pageKey === null || canView(t.pageKey));

  const activeTab = (() => {
    for (const tab of [...tabs].reverse()) {
      if (tab.suffix && pathname.startsWith(basePath + tab.suffix)) return tab.suffix;
    }
    return "";
  })();

  return (
    <div className="border-b border-border bg-card px-6">
      <nav className="flex gap-0 -mb-px overflow-x-auto">
        {tabs.map((tab, i) => {
          const isActive = tab.suffix === activeTab;
          return (
            <Link
              key={tab.suffix}
              href={basePath + tab.suffix}
              className={`
                flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
                ${isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }
              `}
            >
              <span className="font-mono text-[10px] opacity-50">{String(i + 1).padStart(2, "0")}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
