"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import VersionHistory from "@/components/ui/version-history";

interface MoldTab {
  sheetId: string;
  moldNumber: string | null;
  cqVersion?: number;
  hasSaved: boolean;
}

export default function CustomerQuoteMoldBar({ tabs, activeSheetId }: { tabs: MoldTab[]; activeSheetId: string }) {
  const router = useRouter();

  if (tabs.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tabs.map((t) => {
        const isActive = t.sheetId === activeSheetId;
        return (
          <button
            key={t.sheetId}
            type="button"
            onClick={() => router.push(`?mold=${t.sheetId}`, { scroll: false })}
            className="rounded-lg border px-3 py-2 text-left transition-all min-w-[130px]"
            style={{
              borderColor: isActive ? "var(--primary)" : t.hasSaved ? "oklch(0.80 0.12 145)" : "var(--border)",
              background: isActive ? "oklch(0.97 0.01 52)" : t.hasSaved ? "oklch(0.97 0.04 145)" : "var(--card)",
              boxShadow: isActive ? "0 0 0 1px var(--primary)" : "none",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold" style={{ color: isActive ? "var(--primary)" : "var(--foreground)" }}>
                {t.moldNumber ?? "Mold"}
              </span>
              {t.cqVersion && (
                <span className="text-[10px] text-muted-foreground font-mono">v{t.cqVersion}</span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {t.hasSaved ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span className="text-[10px] text-green-700">Saved</span>
                </>
              ) : (
                <>
                  <Circle className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Pending</span>
                </>
              )}
            </div>
          </button>
        );
      })}

      <div className="flex items-center">
        <VersionHistory
          entityType="customer_quote"
          queryParams={{ cost_sheet_id: activeSheetId }}
          displayFields={[
            { key: "winhoop_quote_number", label: "Quote #" },
            { key: "customer_name", label: "Customer" },
            { key: "mold_cost_jpy", label: "Mold Cost", formatHint: "currency" },
            { key: "emboss_cost_jpy", label: "Emboss Cost", formatHint: "currency" },
          ]}
        />
      </div>
    </div>
  );
}
