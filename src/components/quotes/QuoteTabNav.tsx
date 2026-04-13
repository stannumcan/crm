"use client";

import Link from "next/link";
import { usePermissions } from "@/lib/permissions-context";
import type { PageKey } from "@/lib/permissions";

const ALL_TABS: { key: string; label: string; pageKey: PageKey }[] = [
  { key: "requests",       label: "Quote Requests",    pageKey: "quotes_requests" },
  { key: "factory-sheet",  label: "Factory Cost Sheet", pageKey: "quotes_factory_sheet" },
  { key: "wilfred-calc",   label: "Cost Calc",           pageKey: "quotes_wilfred_calc" },
  { key: "ddp-calc",       label: "DDP Calculation",    pageKey: "quotes_ddp_calc" },
  { key: "customer-quote", label: "Customer Quote",     pageKey: "quotes_customer_quote" },
];

export default function QuoteTabNav({ locale, activeTab }: { locale: string; activeTab: string }) {
  const { canView } = usePermissions();
  const tabs = ALL_TABS.filter((t) => canView(t.pageKey));

  return (
    <div className="border-b border-border mb-0">
      <nav className="flex gap-0 -mb-px overflow-x-auto">
        {tabs.map((tab, i) => {
          const isActive = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={`/${locale}/quotes?tab=${tab.key}`}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
                ${isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
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
