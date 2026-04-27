"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import DDPCalcForm from "@/components/calculator/DDPCalcForm";
import StaleCheck from "@/components/ui/stale-check";
import DDPSidebarReference, { type DDPSidebarData } from "@/components/calculator/DDPSidebarReference";
import VersionHistory from "@/components/ui/version-history";

interface SheetData {
  id: string;
  moldNumber: string | null;
  refNumber?: string | null;
  variantLabel?: string | null;
  ddpVersion?: number;
  quoteInfo: {
    companyName: string; projectName: string; woNumber: string; canSize: string;
    moldNumber: string; tinThickness: number | null; moldCostNew: number | null;
    moldCostModify: number | null; moldLeadTime: number | null;
  };
  packagingDefaults: {
    pcsPerCarton: number | null; boxL: number | null; boxW: number | null; boxH: number | null;
    palletL: number | null; palletW: number | null; palletH: number | null;
    boxesPerPallet: number | null; pcsPerPallet: number | null;
    containers: { type: string; pcsPerContainer: number | null }[];
  };
  approvedCalcs: { tier_label: string; quantity: number; estimated_cost_rmb: number | null; approved: boolean; quantity_type: string }[];
  existingDDP: Record<string, unknown>[];
  hasSaved: boolean;
  basedOnSheetVersion?: number;
  basedOnWilfredVersion?: number;
  sidebarData?: DDPSidebarData;
}

interface DDPSettings {
  lcl_rate_per_cbm_le5: number;
  lcl_rate_per_cbm_gt5: number;
  /** Legacy single rate. Falls through to both tiers if the split values aren't set. */
  lcl_rate_per_cbm?: number;
  lcl_base_fee: number;
  fcl_20gp_jpy: number;
  fcl_40gp_jpy: number;
  fcl_40hq_jpy: number;
  margin_values: number[];
  fx_rate: number;
  import_duty_pct: number;
  consumption_tax_pct: number;
}

export default function DDPCalcWrapper({
  locale,
  quoteId,
  sheets: initialSheets,
  shippingRates,
}: {
  locale: string;
  quoteId: string;
  sheets: SheetData[];
  shippingRates: DDPSettings;
}) {
  const router = useRouter();
  const [activeSheet, setActiveSheet] = useState(initialSheets[0]?.id ?? "");
  const [savedSheets, setSavedSheets] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    initialSheets.forEach((s) => { if (s.hasSaved) initial.add(s.id); });
    return initial;
  });
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  // Live prices keyed by sheetId → tier_label → price details
  const [livePrices, setLivePrices] = useState<Record<string, Record<string, { unit_price_jpy: number | null; cost_per_pc_jpy: number | null; shipping_per_pc_jpy: number | null; duty_per_pc_jpy: number | null; total_cost_per_pc_jpy: number | null; shipping_method: string | null }>>>({});

  const allSaved = initialSheets.every((s) => savedSheets.has(s.id));
  const active = initialSheets.find((s) => s.id === activeSheet) ?? initialSheets[0];

  const handleComplete = async () => {
    setCompleting(true);
    setError("");
    try {
      const res = await fetch("/api/ddp-calc/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotation_id: quoteId }),
      });
      if (!res.ok) throw new Error("Failed to complete");
      router.push(`/${locale}/quotes/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setCompleting(false);
    }
  };

  const markSaved = (sheetId: string) => {
    setSavedSheets((prev) => new Set(prev).add(sheetId));
  };

  return (
    <div className="flex gap-6">
      {/* Sticky sidebar */}
      {active?.sidebarData && (
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto rounded-lg border p-4"
            style={{ borderColor: "oklch(0.88 0.04 230)", background: "oklch(0.98 0.005 230)" }}
          >
            <DDPSidebarReference data={{
              ...active.sidebarData,
              ddpPrices: livePrices[active.id] ?? active.sidebarData.ddpPrices,
            }} />
          </div>
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
      {/* Mould card grid */}
      <div className="flex flex-wrap gap-2">
        {initialSheets.map((s) => {
          const isActive = s.id === activeSheet;
          const isSaved = savedSheets.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSheet(s.id)}
              className="rounded-lg border px-3 py-2 text-left transition-all min-w-[130px]"
              style={{
                borderColor: isActive ? "var(--primary)" : isSaved ? "oklch(0.80 0.12 145)" : "var(--border)",
                background: isActive ? "oklch(0.97 0.01 52)" : isSaved ? "oklch(0.97 0.04 145)" : "var(--card)",
                boxShadow: isActive ? "0 0 0 1px var(--primary)" : "none",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold" style={{ color: isActive ? "var(--primary)" : "var(--foreground)" }}>
                  {s.moldNumber ?? "Mold"}
                </span>
                {s.variantLabel && <span className="text-[10px] text-muted-foreground">{s.variantLabel}</span>}
                {s.ddpVersion && (
                  <span className="text-[10px] text-muted-foreground font-mono">v{s.ddpVersion}</span>
                )}
              </div>
              {s.refNumber && (
                <p className="text-[10px] font-mono text-blue-700 mt-0.5">{s.refNumber}/DC</p>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                {isSaved ? (
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

        {/* Counter + History */}
        <div className="flex items-center gap-2 ml-1">
          <span className="text-xs text-muted-foreground">
            {savedSheets.size}/{initialSheets.length} saved
          </span>
          {active && (
            <VersionHistory
              entityType="natsuki_ddp_calculation"
              queryParams={{ cost_sheet_id: active.id }}
              displayFields={[
                { key: "quantity", label: "Qty" },
                { key: "rmb_unit_price", label: "RMB/pc", formatHint: "currency" },
                { key: "unit_price_jpy", label: "JPY/pc", formatHint: "currency" },
                { key: "total_revenue_jpy", label: "Revenue", formatHint: "currency" },
                { key: "selected_margin", label: "Margin", formatHint: "percent" },
              ]}
              groupByField="tier_label"
            />
          )}
        </div>
      </div>

      {/* Stale warnings for active sheet */}
      {active?.basedOnWilfredVersion && (
        <StaleCheck
          upstreamTable="wilfred_calculations"
          upstreamFilters={{ cost_sheet_id: active.id }}
          basedOnVersion={active.basedOnWilfredVersion}
          upstreamName={`Wilfred Calc (${active.moldNumber})`}
        />
      )}

      {/* Active mould form */}
      {active && (
        <DDPCalcForm
          key={active.id}
          locale={locale}
          quoteId={quoteId}
          costSheetId={active.id}
          quoteInfo={active.quoteInfo}
          packagingDefaults={active.packagingDefaults}
          approvedCalcs={active.approvedCalcs}
          existingDDP={active.existingDDP}
          shippingRates={shippingRates}
          onSaved={() => markSaved(active.id)}
          onLivePricesChange={(p) => setLivePrices((prev) => ({ ...prev, [active.id]: p }))}
        />
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Bottom actions */}
      <div className="flex gap-3 justify-end border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/quotes/${quoteId}`)}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleComplete}
          disabled={!allSaved || completing}
          className={allSaved ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {completing ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Completing...</>
          ) : allSaved ? (
            "Complete All & Send"
          ) : (
            `Save all moulds first (${savedSheets.size}/${initialSheets.length})`
          )}
        </Button>
      </div>
      </div>{/* end flex-1 main content */}
    </div>
  );
}
