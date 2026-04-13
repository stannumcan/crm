"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import DDPCalcForm from "@/components/calculator/DDPCalcForm";
import StaleCheck from "@/components/ui/stale-check";

interface SheetData {
  id: string;
  moldNumber: string | null;
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
}

interface DDPSettings {
  lcl_rate_per_cbm: number;
  lcl_base_fee: number;
  fcl_20gp_jpy: number;
  fcl_40gp_jpy: number;
  fcl_40hq_jpy: number;
  margin_values: number[];
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
    <div className="space-y-4">
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
                {s.ddpVersion && (
                  <span className="text-[10px] text-muted-foreground font-mono">v{s.ddpVersion}</span>
                )}
              </div>
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

        {/* Counter */}
        <div className="flex items-center ml-1">
          <span className="text-xs text-muted-foreground">
            {savedSheets.size}/{initialSheets.length} saved
          </span>
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
    </div>
  );
}
