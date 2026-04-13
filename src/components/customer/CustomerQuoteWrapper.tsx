"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import StaleCheck from "@/components/ui/stale-check";
import VersionHistory from "@/components/ui/version-history";

interface MoldTab {
  sheetId: string;
  moldNumber: string | null;
  cqVersion?: number;
  hasSaved: boolean;
  basedOnDdpVersion?: number;
}

interface Props {
  tabs: MoldTab[];
  /** Pre-rendered forms keyed by sheetId */
  forms: Record<string, React.ReactNode>;
}

export default function CustomerQuoteWrapper({ tabs, forms }: Props) {
  const [activeSheet, setActiveSheet] = useState(tabs[0]?.sheetId ?? "");
  const active = tabs.find((t) => t.sheetId === activeSheet) ?? tabs[0];

  return (
    <div className="space-y-4">
      {/* Mould card grid */}
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const isActive = t.sheetId === activeSheet;
            return (
              <button
                key={t.sheetId}
                type="button"
                onClick={() => setActiveSheet(t.sheetId)}
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

          {/* History */}
          {active && (
            <div className="flex items-center">
              <VersionHistory
                entityType="customer_quote"
                queryParams={{ cost_sheet_id: active.sheetId }}
                displayFields={[
                  { key: "winhoop_quote_number", label: "Quote #" },
                  { key: "customer_name", label: "Customer" },
                  { key: "mold_cost_jpy", label: "Mold Cost", formatHint: "currency" },
                  { key: "emboss_cost_jpy", label: "Emboss Cost", formatHint: "currency" },
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* Stale warning for active mould */}
      {active?.basedOnDdpVersion && (
        <StaleCheck
          upstreamTable="natsuki_ddp_calculations"
          upstreamFilters={{ cost_sheet_id: active.sheetId }}
          basedOnVersion={active.basedOnDdpVersion}
          upstreamName={`DDP Calculation (${active.moldNumber})`}
        />
      )}

      {/* Active mould form */}
      {active && forms[active.sheetId]}
    </div>
  );
}
