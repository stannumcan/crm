"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", suffix: "" },
  { label: "Quote Request", suffix: "/request" },
  { label: "Factory Sheet", suffix: "/factory-sheet" },
  { label: "Wilfred Calc", suffix: "/cost-calc" },
  { label: "DDP Calc", suffix: "/ddp-calc" },
  { label: "Customer Quote", suffix: "/customer-quote" },
];

export default function QuoteSubNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  // Determine active tab by matching the current path suffix
  const activeTab = (() => {
    // Check from most specific to least
    for (const tab of [...TABS].reverse()) {
      if (tab.suffix && pathname.startsWith(basePath + tab.suffix)) return tab.suffix;
    }
    // Overview: exactly the basePath or basePath/
    if (pathname === basePath || pathname === basePath + "/") return "";
    return "";
  })();

  return (
    <div className="border-b border-border bg-card px-6">
      <nav className="flex gap-0 -mb-px overflow-x-auto">
        {TABS.map((tab, i) => {
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
