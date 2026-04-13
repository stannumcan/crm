"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import WilfredCalcForm from "@/components/calculator/WilfredCalcForm";
import VersionHistory from "@/components/ui/version-history";
import type { FactorySheetRefData } from "@/components/calculator/FactorySheetReference";

interface FeesData {
  moldCostNew: number | null;
  moldCostAdjust: number | null;
  embossingLines: { component: string; cost_rmb: string; notes: string }[] | null;
  wilfredEmbossingCost: number | null;
  wilfredMoldCostNew: number | null;
  wilfredMoldCostAdjust: number | null;
  feesApproved: boolean;
  feesNotes: string | null;
}

interface SheetEntry {
  id: string;
  moldNumber: string | null;
  steelThickness: number | null;
  version: number;
  wilfredVersion?: number;
  basedOnSheetVersion?: number;
  isApproved: boolean;
  factoryTiers: { id: string; tier_label: string; quantity: number; total_subtotal: number | null; labor_cost: number | null; accessories_cost: number | null; container_info: string | null }[];
  existingCalcs: { id: string; tier_label: string; total_subtotal: number; labor_cost: number; accessories_cost: number; overhead_multiplier: number; margin_rate: number; estimated_cost_rmb: number | null; approved: boolean; wilfred_notes: string | null }[];
  fees: FeesData;
  sheetRef?: FactorySheetRefData;
}

export default function CostCalcWrapper({
  locale,
  quoteId,
  sheets,
}: {
  locale: string;
  quoteId: string;
  sheets: SheetEntry[];
}) {
  const [activeSheet, setActiveSheet] = useState(sheets[0]?.id ?? "");
  const active = sheets.find((s) => s.id === activeSheet) ?? sheets[0];

  return (
    <div className="space-y-4">
      {/* Mould card grid */}
      {sheets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {sheets.map((s) => {
            const isActive = s.id === activeSheet;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSheet(s.id)}
                className="rounded-lg border px-3 py-2 text-left transition-all min-w-[130px]"
                style={{
                  borderColor: isActive ? "var(--primary)" : s.isApproved ? "oklch(0.80 0.12 145)" : "var(--border)",
                  background: isActive ? "oklch(0.97 0.01 52)" : s.isApproved ? "oklch(0.97 0.04 145)" : "var(--card)",
                  boxShadow: isActive ? "0 0 0 1px var(--primary)" : "none",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold" style={{ color: isActive ? "var(--primary)" : "var(--foreground)" }}>
                    {s.moldNumber ?? "Mold"}
                  </span>
                  {s.wilfredVersion && (
                    <span className="text-[10px] text-muted-foreground font-mono">v{s.wilfredVersion}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {s.isApproved ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      <span className="text-[10px] text-green-700">Approved</span>
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

          {/* History button for active mould */}
          {active && (
            <div className="flex items-center">
              <VersionHistory
                entityType="wilfred_calculation"
                queryParams={{ cost_sheet_id: active.id }}
                displayFields={[
                  { key: "total_subtotal", label: "Total", formatHint: "currency" },
                  { key: "labor_cost", label: "Labor", formatHint: "currency" },
                  { key: "accessories_cost", label: "Acc", formatHint: "currency" },
                  { key: "margin_rate", label: "Margin", formatHint: "percent" },
                  { key: "estimated_cost_rmb", label: "Est. Cost", formatHint: "currency" },
                  { key: "approved", label: "Approved" },
                ]}
                groupByField="tier_label"
              />
            </div>
          )}
        </div>
      )}

      {/* Active mould form */}
      {active && (
        <WilfredCalcForm
          key={active.id}
          locale={locale}
          quoteId={quoteId}
          costSheetId={active.id}
          factoryTiers={active.factoryTiers}
          existingCalcs={active.existingCalcs}
          sheetVersion={active.version}
          wilfredVersion={active.wilfredVersion}
          basedOnSheetVersion={active.basedOnSheetVersion}
          sheetRef={active.sheetRef}
          fees={active.fees}
        />
      )}
    </div>
  );
}
