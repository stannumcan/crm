"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { calculateDDP, formatJPY } from "@/lib/calculations";

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuoteInfo {
  companyName: string;
  projectName: string;
  woNumber: string;
  canSize: string;
  moldNumber: string;
  tinThickness: number | null;
  moldCostNew: number | null;
  moldCostModify: number | null;
  moldLeadTime: number | null;
}

interface ContainerSpec {
  type: string;
  pcsPerContainer: number | null;
}

interface PackagingDefaults {
  pcsPerCarton: number | null;
  boxL: number | null;
  boxW: number | null;
  boxH: number | null;
  palletL: number | null;
  palletW: number | null;
  palletH: number | null;
  boxesPerPallet: number | null;
  pcsPerPallet: number | null;
  containers: ContainerSpec[];
}

interface ApprovedCalc {
  tier_label: string;
  quantity: number;
  quantity_type: string;
  estimated_cost_rmb: number | null;
}

interface DDPSettings {
  // LCL is split by CBM tier — small (<=5 CBM) typically priced higher per cubic meter.
  lcl_rate_per_cbm_le5: number;
  lcl_rate_per_cbm_gt5: number;
  /** Legacy single rate. Falls through to both tiers if the split values aren't set. */
  lcl_rate_per_cbm?: number;
  lcl_base_fee: number;
  fcl_20gp_jpy: number;
  fcl_40gp_jpy: number;
  fcl_40hq_jpy: number;
  margin_values: number[];
  // Persisted shared rates (previously hardcoded defaults that reset every load).
  fx_rate: number;             // 1 RMB = X JPY
  import_duty_pct: number;     // %, e.g. 4
  consumption_tax_pct: number; // %, e.g. 0
}

interface TierState {
  tier_label: string;
  quantity: string;
  rmbUnitPrice: string;
  bufferPct: string;
  shippingType: "auto" | "lcl" | "fcl_20gp" | "fcl_40gp" | "fcl_40hq" | "multi_container";
  manualShippingCostJpy: string;
  selectedMarginIdx: string; // index into marginValues array
  manualUnitPriceJpy: string; // user override for selling price; "" = use computed
}

interface PackagingState {
  pcsPerCarton: string;
  boxL: string;
  boxW: string;
  boxH: string;
  palletL: string;
  palletW: string;
  palletH: string;
  boxesPerPallet: string;
  pcsPerPallet: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function autoShippingType(_quantityType: string): TierState["shippingType"] {
  // Default to "auto" — the algorithm picks cheapest valid shipping.
  // Manual override is still available via the dropdown.
  return "auto";
}

function initTier(calc: ApprovedCalc, existing?: { unit_price_jpy?: number | null; selected_margin?: number | null; shipping_cost_jpy?: number | null }, marginValues?: number[]): TierState {
  // If there's an existing saved DDP record, pre-populate the manual override
  // so the form shows the user's previously-saved selling price
  const savedUnitPrice = existing?.unit_price_jpy != null ? String(existing.unit_price_jpy) : "";

  // Try to match selected_margin to its index in the default margin array
  let selIdx = "4";
  if (existing?.selected_margin != null && marginValues) {
    const targetPct = existing.selected_margin * 100;
    const idx = marginValues.findIndex((m) => Math.abs(m - targetPct) < 0.01);
    if (idx >= 0) selIdx = String(idx);
  }

  return {
    tier_label: calc.tier_label,
    quantity: String(calc.quantity ?? ""),
    rmbUnitPrice: calc.estimated_cost_rmb != null ? calc.estimated_cost_rmb.toFixed(4) : "",
    bufferPct: "5",
    shippingType: autoShippingType(calc.quantity_type),
    manualShippingCostJpy: existing?.shipping_cost_jpy != null ? String(existing.shipping_cost_jpy) : "",
    selectedMarginIdx: selIdx,
    manualUnitPriceJpy: savedUnitPrice,
  };
}

function initPackaging(defaults: PackagingDefaults): PackagingState {
  return {
    pcsPerCarton: defaults.pcsPerCarton != null ? String(defaults.pcsPerCarton) : "",
    boxL: defaults.boxL != null ? String(defaults.boxL) : "",
    boxW: defaults.boxW != null ? String(defaults.boxW) : "",
    boxH: defaults.boxH != null ? String(defaults.boxH) : "",
    palletL: defaults.palletL != null ? String(defaults.palletL) : "",
    palletW: defaults.palletW != null ? String(defaults.palletW) : "",
    palletH: defaults.palletH != null ? String(defaults.palletH) : "",
    boxesPerPallet: defaults.boxesPerPallet != null ? String(defaults.boxesPerPallet) : "",
    pcsPerPallet: defaults.pcsPerPallet != null ? String(defaults.pcsPerPallet) : "",
  };
}

const SHIPPING_OPTIONS: { value: TierState["shippingType"]; label: string }[] = [
  { value: "auto", label: "Auto (cheapest)" },
  { value: "lcl", label: "LCL" },
  { value: "fcl_20gp", label: "20GP" },
  { value: "fcl_40gp", label: "40GP" },
  { value: "fcl_40hq", label: "40HQ" },
  { value: "multi_container", label: "Multiple containers (manual)" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DDPCalcForm({
  locale,
  quoteId,
  costSheetId,
  quoteInfo,
  packagingDefaults,
  approvedCalcs,
  existingDDP,
  shippingRates: defaultSettings,
  onSaved,
  onLivePricesChange,
}: {
  locale: string;
  quoteId: string;
  costSheetId: string;
  quoteInfo: QuoteInfo;
  packagingDefaults: PackagingDefaults;
  approvedCalcs: ApprovedCalc[];
  existingDDP: Record<string, unknown>[];
  shippingRates: DDPSettings;
  onSaved?: () => void;
  onLivePricesChange?: (prices: Record<string, { unit_price_jpy: number | null; cost_per_pc_jpy: number | null; shipping_per_pc_jpy: number | null; duty_per_pc_jpy: number | null; total_cost_per_pc_jpy: number | null; shipping_method: string | null }>) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Brief banner after a successful save so the user can see it actually fired.
  // Cleared after a few seconds, or when they navigate.
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Shared settings (now persisted globally — used to reset to hardcoded defaults)
  const [fxRate, setFxRate] = useState(String(defaultSettings.fx_rate ?? 20));
  const [importDutyRate, setImportDutyRate] = useState(String(defaultSettings.import_duty_pct ?? 4));
  const [consumptionTaxRate, setConsumptionTaxRate] = useState(String(defaultSettings.consumption_tax_pct ?? 0));

  // Shipping rates + margin values (editable, persisted globally on save)
  const [lclRatePerCbmLe5, setLclRatePerCbmLe5] = useState(
    String(defaultSettings.lcl_rate_per_cbm_le5 ?? defaultSettings.lcl_rate_per_cbm ?? 23000),
  );
  const [lclRatePerCbmGt5, setLclRatePerCbmGt5] = useState(
    String(defaultSettings.lcl_rate_per_cbm_gt5 ?? defaultSettings.lcl_rate_per_cbm ?? 18000),
  );
  const [lclBaseFee, setLclBaseFee] = useState(String(defaultSettings.lcl_base_fee));
  const [fcl20gpCost, setFcl20gpCost] = useState(String(defaultSettings.fcl_20gp_jpy));
  const [fcl40gpCost, setFcl40gpCost] = useState(String(defaultSettings.fcl_40gp_jpy));
  const [fcl40hqCost, setFcl40hqCost] = useState(String(defaultSettings.fcl_40hq_jpy));
  const [marginValues, setMarginValues] = useState<string[]>(
    () => (defaultSettings.margin_values ?? [60, 55, 50, 45, 40, 35, 30, 25]).map(String)
  );
  const updateMarginValue = (idx: number, val: string) =>
    setMarginValues((prev) => prev.map((v, i) => (i === idx ? val : v)));

  // Packaging (auto-filled, editable)
  const [pkg, setPkg] = useState<PackagingState>(() => initPackaging(packagingDefaults));
  const updatePkg = (field: keyof PackagingState, value: string) =>
    setPkg((prev) => ({ ...prev, [field]: value }));

  // Per-tier state
  const [tiers, setTiers] = useState<TierState[]>(() => {
    const defaultMargins = defaultSettings.margin_values ?? [60, 55, 50, 45, 40, 35, 30, 25];
    return approvedCalcs.map((c) => {
      const existing = existingDDP.find((d) => (d as { tier_label?: string }).tier_label === c.tier_label) as { unit_price_jpy?: number | null; selected_margin?: number | null; shipping_cost_jpy?: number | null } | undefined;
      return initTier(c, existing, defaultMargins);
    });
  });
  const updateTier = (label: string, field: keyof TierState, value: string) =>
    setTiers((prev) => prev.map((t) => t.tier_label === label ? { ...t, [field]: value } : t));

  // Container capacities (tins per container) from factory sheet
  const pcs20GP = packagingDefaults.containers.find((c) => c.type === "20GP")?.pcsPerContainer ?? 0;
  const pcs40GP = packagingDefaults.containers.find((c) => c.type === "40GP")?.pcsPerContainer ?? 0;
  const pcs40HQ = packagingDefaults.containers.find((c) => c.type === "40HQ")?.pcsPerContainer ?? 0;

  // Build calc result for a tier
  function calcTier(tier: TierState) {
    const qty = parseInt(tier.quantity);
    const rmb = parseFloat(tier.rmbUnitPrice);
    const fx = parseFloat(fxRate);
    const pcs = parseInt(pkg.pcsPerCarton);
    const bpp = parseInt(pkg.boxesPerPallet);
    if (!qty || !rmb || !fx || !pcs || !bpp) return null;
    const parsedMargins = marginValues.map((m) => parseFloat(m) / 100).filter((m) => !isNaN(m) && m >= 0);
    const selIdx = Math.min(parseInt(tier.selectedMarginIdx) || 0, parsedMargins.length - 1);
    return calculateDDP({
      customerOrderQty: qty,
      rmbUnitPrice: rmb,
      fxRate: fx,
      pcsPerCarton: pcs,
      boxLmm: parseFloat(pkg.boxL) || 1,
      boxWmm: parseFloat(pkg.boxW) || 1,
      boxHmm: parseFloat(pkg.boxH) || 1,
      palletLmm: parseFloat(pkg.palletL) || 1200,
      palletWmm: parseFloat(pkg.palletW) || 1000,
      palletHmm: parseFloat(pkg.palletH) || 1100,
      boxesPerPallet: bpp,
      pcs20GP,
      pcs40GP,
      pcs40HQ,
      bufferPct: parseFloat(tier.bufferPct) / 100 || 0.05,
      shippingType: tier.shippingType,
      manualShippingCostJpy: tier.manualShippingCostJpy ? parseInt(tier.manualShippingCostJpy) : undefined,
      lclRatePerCbmLe5: parseFloat(lclRatePerCbmLe5) || 23000,
      lclRatePerCbmGt5: parseFloat(lclRatePerCbmGt5) || 18000,
      lclBaseFee: parseFloat(lclBaseFee) || 0,
      fcl20gpCost: parseFloat(fcl20gpCost) || 250000,
      fcl40gpCost: parseFloat(fcl40gpCost) || 400000,
      fcl40hqCost: parseFloat(fcl40hqCost) || 0,
      margins: parsedMargins,
      importDutyRate: parseFloat(importDutyRate) / 100,
      consumptionTaxRate: parseFloat(consumptionTaxRate) / 100,
      selectedMargin: parsedMargins[selIdx] ?? 0.4,
    });
  }

  // Push live prices up to parent for sidebar display
  useEffect(() => {
    if (!onLivePricesChange) return;
    const prices: Record<string, { unit_price_jpy: number | null; cost_per_pc_jpy: number | null; shipping_per_pc_jpy: number | null; duty_per_pc_jpy: number | null; total_cost_per_pc_jpy: number | null; shipping_method: string | null }> = {};
    for (const tier of tiers) {
      const result = calcTier(tier);
      const qty = parseInt(tier.quantity) || 0;
      const manual = parseInt(tier.manualUnitPriceJpy);
      const sellingPrice = !isNaN(manual) && manual > 0
        ? manual
        : result?.unitPriceJpy ?? null;
      prices[tier.tier_label] = {
        unit_price_jpy: sellingPrice,
        cost_per_pc_jpy: result && qty > 0 ? Math.round(result.manufacturingCostJpy / qty) : null,
        shipping_per_pc_jpy: result && qty > 0 ? Math.round((result.shippingCostJpy / qty) * 100) / 100 : null,
        duty_per_pc_jpy: result && qty > 0 ? Math.round((result.importDutyJpy / qty) * 100) / 100 : null,
        total_cost_per_pc_jpy: result && qty > 0 ? Math.round(result.totalCostJpy / qty) : null,
        shipping_method: result?.shippingMethod ?? null,
      };
    }
    onLivePricesChange(prices);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiers, fxRate, pkg, marginValues, lclRatePerCbmLe5, lclRatePerCbmGt5, lclBaseFee, fcl20gpCost, fcl40gpCost, fcl40hqCost, importDutyRate, consumptionTaxRate]);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const tiersPayload = tiers.map((tier) => {
        const qty = parseInt(tier.quantity);
        const rmb = parseFloat(tier.rmbUnitPrice);
        const fx = parseFloat(fxRate);
        const pcs = parseInt(pkg.pcsPerCarton);
        const bpp = parseInt(pkg.boxesPerPallet);
        if (!qty || !rmb || !fx || !pcs || !bpp) {
          throw new Error(`Tier ${tier.tier_label}: fill in all required fields`);
        }
        const parsedMargins = marginValues.map((m) => parseFloat(m) / 100).filter((m) => !isNaN(m) && m >= 0);
        const selIdx = Math.min(parseInt(tier.selectedMarginIdx) || 0, parsedMargins.length - 1);
        return {
          tier_label: tier.tier_label,
          customerOrderQty: qty,
          rmbUnitPrice: rmb,
          fxRate: fx,
          pcsPerCarton: pcs,
          boxLmm: parseFloat(pkg.boxL) || 1,
          boxWmm: parseFloat(pkg.boxW) || 1,
          boxHmm: parseFloat(pkg.boxH) || 1,
          palletLmm: parseFloat(pkg.palletL) || 1200,
          palletWmm: parseFloat(pkg.palletW) || 1000,
          palletHmm: parseFloat(pkg.palletH) || 1100,
          boxesPerPallet: bpp,
          pcs20GP,
          pcs40GP,
          pcs40HQ,
          bufferPct: parseFloat(tier.bufferPct) / 100 || 0.05,
          shippingType: tier.shippingType,
          manualShippingCostJpy: tier.manualShippingCostJpy ? parseInt(tier.manualShippingCostJpy) : undefined,
          lclRatePerCbmLe5: parseFloat(lclRatePerCbmLe5) || 23000,
          lclRatePerCbmGt5: parseFloat(lclRatePerCbmGt5) || 18000,
          lclBaseFee: parseFloat(lclBaseFee) || 0,
          fcl20gpCost: parseFloat(fcl20gpCost) || 250000,
          fcl40gpCost: parseFloat(fcl40gpCost) || 400000,
          fcl40hqCost: parseFloat(fcl40hqCost) || 0,
          margins: parsedMargins,
          importDutyRate: parseFloat(importDutyRate) / 100,
          consumptionTaxRate: parseFloat(consumptionTaxRate) / 100,
          selectedMargin: parsedMargins[selIdx] ?? 0.4,
          manualUnitPriceJpy: tier.manualUnitPriceJpy ? parseInt(tier.manualUnitPriceJpy) : undefined,
        };
      });

      // Save DDP records and shipping settings in parallel
      const [ddpRes, settingsRes] = await Promise.all([
        fetch("/api/ddp-calc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quotation_id: quoteId, cost_sheet_id: costSheetId, tiers: tiersPayload }),
        }),
        fetch("/api/app-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "ddp_shipping",
            value: {
              lcl_rate_per_cbm_le5: parseFloat(lclRatePerCbmLe5) || 23000,
              lcl_rate_per_cbm_gt5: parseFloat(lclRatePerCbmGt5) || 18000,
              lcl_base_fee: parseFloat(lclBaseFee) || 0,
              fcl_20gp_jpy: parseFloat(fcl20gpCost) || 250000,
              fcl_40gp_jpy: parseFloat(fcl40gpCost) || 400000,
              // 40HQ: 0 disables this container in the auto algorithm
              fcl_40hq_jpy: parseFloat(fcl40hqCost) || 0,
              margin_values: marginValues.map((m) => parseFloat(m)).filter((m) => !isNaN(m) && m >= 0),
              fx_rate: parseFloat(fxRate) || 20,
              import_duty_pct: parseFloat(importDutyRate) || 0,
              consumption_tax_pct: parseFloat(consumptionTaxRate) || 0,
            },
          }),
        }),
      ]);
      if (!ddpRes.ok) throw new Error((await ddpRes.json()).error ?? "Failed to save DDP records");
      // Settings save was previously silently ignored — surface its failure too,
      // since users were reporting "settings not saving" with no error shown.
      if (!settingsRes.ok) throw new Error((await settingsRes.json()).error ?? "Failed to save shared settings");
      setLoading(false);
      setSavedAt(Date.now());
      // Re-fetch the parent server component so the next mount of THIS form
      // (or any sibling sheet's form) picks up the freshly-saved settings.
      // Without this, switching to another mould's tab would re-mount the form
      // with the stale shippingRates prop and look like the save was reverted.
      router.refresh();
      if (onSaved) onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  // Box CBM display
  const boxCbm = (() => {
    const l = parseFloat(pkg.boxL), w = parseFloat(pkg.boxW), h = parseFloat(pkg.boxH);
    if (l && w && h) return ((l * w * h) / 1_000_000_000).toFixed(4);
    return null;
  })();

  return (
    <div className="space-y-5">
      {existingDDP.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
          DDP calculations already saved for this quote. Saving will create a new version.
        </div>
      )}

      {/* ── Quote Summary ─────────────────────────────────────────── */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><span className="text-gray-400 text-xs">Customer</span><br /><span className="font-medium">{quoteInfo.companyName}</span></span>
            <span><span className="text-gray-400 text-xs">Style</span><br /><span className="font-medium">{quoteInfo.projectName}</span></span>
            {quoteInfo.canSize && <span><span className="text-gray-400 text-xs">Can Size</span><br /><span className="font-medium">{quoteInfo.canSize}</span></span>}
            {quoteInfo.tinThickness != null && <span><span className="text-gray-400 text-xs">板厚 Thickness</span><br /><span className="font-medium">{quoteInfo.tinThickness} mm</span></span>}
            {quoteInfo.moldNumber && <span><span className="text-gray-400 text-xs">Mold</span><br /><span className="font-mono font-medium">{quoteInfo.moldNumber}</span></span>}
            {quoteInfo.moldCostNew != null && <span><span className="text-gray-400 text-xs">New Mold</span><br /><span className="font-medium">¥{quoteInfo.moldCostNew.toLocaleString()} RMB</span></span>}
            {quoteInfo.moldCostModify != null && <span><span className="text-gray-400 text-xs">Adj. Cost</span><br /><span className="font-medium">¥{quoteInfo.moldCostModify.toLocaleString()} RMB</span></span>}
            {quoteInfo.moldLeadTime != null && <span><span className="text-gray-400 text-xs">Lead Time</span><br /><span className="font-medium">{quoteInfo.moldLeadTime} days</span></span>}
          </div>
        </CardContent>
      </Card>

      {/* ── Shared Settings + Packaging ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        {/* Shared currency / tax / shipping rates */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Shared Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-gray-400">Applies to all quantities. Shipping rates are saved globally for future sessions.</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">FX Rate (1 RMB = JPY)</Label>
                <Input type="number" step="0.1" value={fxRate} onChange={(e) => setFxRate(e.target.value)} placeholder="20" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Import Duty %</Label>
                <Input type="number" step="0.1" value={importDutyRate} onChange={(e) => setImportDutyRate(e.target.value)} placeholder="4" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Consumption Tax %</Label>
                <Input type="number" step="0.1" value={consumptionTaxRate} onChange={(e) => setConsumptionTaxRate(e.target.value)} placeholder="0" className="h-8" />
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Margin Options (%)</p>
              <div className="grid grid-cols-4 gap-2 mb-1">
                {marginValues.map((mv, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={mv}
                      onChange={(e) => updateMarginValue(i, e.target.value)}
                      className="h-7 font-mono text-xs"
                    />
                    <span className="text-xs text-gray-400 shrink-0">%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Shipping Rates (JPY)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">LCL Rate per CBM — ≤5 CBM (¥)</Label>
                  <Input type="number" value={lclRatePerCbmLe5} onChange={(e) => setLclRatePerCbmLe5(e.target.value)} className="h-8 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">LCL Rate per CBM — &gt;5 CBM (¥)</Label>
                  <Input type="number" value={lclRatePerCbmGt5} onChange={(e) => setLclRatePerCbmGt5(e.target.value)} className="h-8 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">LCL Base Fee (¥)</Label>
                  <Input type="number" value={lclBaseFee} onChange={(e) => setLclBaseFee(e.target.value)} className="h-8 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">20GP Cost (¥)</Label>
                  <Input type="number" value={fcl20gpCost} onChange={(e) => setFcl20gpCost(e.target.value)} className="h-8 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">40GP Cost (¥)</Label>
                  <Input type="number" value={fcl40gpCost} onChange={(e) => setFcl40gpCost(e.target.value)} className="h-8 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">40HQ Cost (¥) <span className="text-gray-400 font-normal">— 0 to disable</span></Label>
                  <Input type="number" value={fcl40hqCost} onChange={(e) => setFcl40hqCost(e.target.value)} className="h-8 font-mono" placeholder="0 = disabled" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Packaging specs */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Packaging Specs</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 mb-3">Auto-filled from factory sheet — edit if needed</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pcs / Carton</Label>
                <Input type="number" value={pkg.pcsPerCarton} onChange={(e) => updatePkg("pcsPerCarton", e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Box L (mm)</Label>
                <Input type="number" value={pkg.boxL} onChange={(e) => updatePkg("boxL", e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Box W (mm)</Label>
                <Input type="number" value={pkg.boxW} onChange={(e) => updatePkg("boxW", e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  Box H (mm)
                  {boxCbm && <span className="text-gray-400 font-normal">{boxCbm} m³</span>}
                </Label>
                <Input type="number" value={pkg.boxH} onChange={(e) => updatePkg("boxH", e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Boxes / Pallet</Label>
                <Input type="number" value={pkg.boxesPerPallet} onChange={(e) => updatePkg("boxesPerPallet", e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pallet L (mm)</Label>
                <Input type="number" value={pkg.palletL} onChange={(e) => updatePkg("palletL", e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pallet W (mm)</Label>
                <Input type="number" value={pkg.palletW} onChange={(e) => updatePkg("palletW", e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pallet H (mm)</Label>
                <Input type="number" value={pkg.palletH} onChange={(e) => updatePkg("palletH", e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pcs / Pallet</Label>
                <Input type="number" value={pkg.pcsPerPallet} onChange={(e) => updatePkg("pcsPerPallet", e.target.value)} className="h-8 font-mono" />
              </div>
            </div>
            {packagingDefaults.containers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Container Capacity</p>
                <div className="grid grid-cols-3 gap-2">
                  {packagingDefaults.containers.map((c) => (
                    <div key={c.type} className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-center">
                      <p className="text-xs font-semibold text-gray-500">{c.type}</p>
                      <p className="text-sm font-bold text-gray-800 font-mono">
                        {c.pcsPerContainer != null ? c.pcsPerContainer.toLocaleString() : "—"}
                      </p>
                      <p className="text-xs text-gray-400">pcs</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Per-Quantity Pricing Blocks ───────────────────────────── */}
      <div className="space-y-6">
        {tiers.map((tier) => {
          const result = calcTier(tier);
          const qty = parseInt(tier.quantity) || 0;

          return (
            <div key={tier.tier_label}>
              <div className="grid grid-cols-5 gap-5">

                {/* Left: inputs (2/5) */}
                <div className="col-span-2 space-y-4">
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Qty {tier.quantity ? parseInt(tier.quantity).toLocaleString() : "—"} pcs — Inputs</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5 col-span-1">
                          <Label className="text-xs">Customer Order Qty (pcs)</Label>
                          <Input
                            type="number"
                            value={tier.quantity}
                            onChange={(e) => updateTier(tier.tier_label, "quantity", e.target.value)}
                            className="font-mono"
                          />
                        </div>
                        <div className="space-y-1.5 col-span-1">
                          <Label className="text-xs">Buffer %</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={tier.bufferPct}
                              onChange={(e) => updateTier(tier.tier_label, "bufferPct", e.target.value)}
                              className="font-mono"
                            />
                            <span className="text-sm text-gray-400 shrink-0">%</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Manufacturing Unit Price</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-9 px-3 rounded-md border bg-muted/40 flex items-center font-mono text-sm">
                            ¥{tier.rmbUnitPrice || "—"} <span className="text-muted-foreground text-xs ml-1">RMB/pc</span>
                          </div>
                          <div className="flex-1 h-9 px-3 rounded-md border bg-muted/40 flex items-center font-mono text-sm">
                            ¥{(() => {
                              const rmb = parseFloat(tier.rmbUnitPrice);
                              const fx = parseFloat(fxRate);
                              if (isNaN(rmb) || isNaN(fx)) return "—";
                              return Math.round(rmb * fx).toLocaleString();
                            })()} <span className="text-muted-foreground text-xs ml-1">JPY/pc</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Shipping Type</Label>
                        <Select
                          value={tier.shippingType}
                          onValueChange={(v) => v && updateTier(tier.tier_label, "shippingType", v)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SHIPPING_OPTIONS.map(({ value, label }) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {tier.shippingType === "multi_container" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Manual Shipping Cost (JPY)</Label>
                          <Input
                            type="number"
                            value={tier.manualShippingCostJpy}
                            onChange={(e) => updateTier(tier.tier_label, "manualShippingCostJpy", e.target.value)}
                            placeholder="Enter total shipping cost"
                            className="font-mono"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right: results (3/5) */}
                <div className="col-span-3">
                  {!result ? (
                    <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-gray-200 text-gray-400 text-sm py-16">
                      Fill in order qty, RMB price, and packaging specs to see results
                    </div>
                  ) : (
                    <Card className="border-blue-200">
                      <CardContent className="pt-4 space-y-4">

                        {/* Logistics */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Logistics</p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            <Row label="Customer order qty" value={`${qty.toLocaleString()} pcs`} />
                            <Row label={`+${tier.bufferPct || 5}% buffer qty`} value={`${Math.round(qty * (1 + (parseFloat(tier.bufferPct) || 5) / 100)).toLocaleString()} pcs`} />
                            <Row label="Cartons ordered" value={result.cartonsOrdered.toLocaleString()} />
                            <Row label="Factory production qty" value={`${result.factoryProductionQty.toLocaleString()} pcs`} />
                            <Row label="Pallets" value={result.pallets.toLocaleString()} />
                            <Row label="Total CBM" value={`${result.totalCBM} m³`} />
                            <Row label="Shipping method" value={result.shippingMethod} />
                          </div>
                        </div>

                        <Separator />

                        {/* Costs */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cost Breakdown</p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            <Row label="Manufacturing" value={formatJPY(result.manufacturingCostJpy)} />
                            <Row
                              label={
                                tier.shippingType === "auto"
                                  ? `Shipping (Auto → ${result.shippingMethod})`
                                  : `Shipping (${result.shippingMethod})`
                              }
                              value={formatJPY(result.shippingCostJpy)}
                            />
                            <Row label={`Import duty (${importDutyRate}%)`} value={formatJPY(result.importDutyJpy)} />
                            {result.consumptionTaxJpy > 0 && (
                              <Row label={`Consumption tax (${consumptionTaxRate}%)`} value={formatJPY(result.consumptionTaxJpy)} />
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                            <span className="text-sm font-semibold text-gray-700">Total DDP Cost</span>
                            <span className="text-base font-bold text-blue-800">{formatJPY(result.totalCostJpy)}</span>
                          </div>
                        </div>

                        <Separator />

                        {/* Margin picker */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Selling Price by Margin</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {result.marginOptions.map((opt, i) => {
                              const pct = +(opt.margin * 100).toFixed(2);
                              const isSelected = tier.selectedMarginIdx === String(i);
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => updateTier(tier.tier_label, "selectedMarginIdx", String(i))}
                                  className={`rounded-md border p-2 text-left transition-colors ${
                                    isSelected
                                      ? "border-blue-500 bg-blue-50"
                                      : "border-gray-200 hover:bg-gray-50"
                                  }`}
                                >
                                  <p className={`text-xs font-semibold ${isSelected ? "text-blue-600" : "text-gray-400"}`}>{pct}%</p>
                                  <p className={`text-sm font-bold leading-tight ${isSelected ? "text-blue-800" : "text-gray-700"}`}>
                                    {formatJPY(opt.unitPrice)}<span className="text-xs font-normal">/pc</span>
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">{formatJPY(opt.total)}</p>
                                  <p className={`text-xs mt-0.5 font-medium ${isSelected ? "text-green-600" : "text-green-500"}`}>
                                    +{formatJPY(opt.total - result.totalCostJpy)}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Selected price banner — cost vs editable selling price */}
                        {(() => {
                          const qty = parseInt(tier.quantity) || 0;
                          const costPerPc = qty > 0 ? Math.round(result.totalCostJpy / qty) : 0;
                          const manual = parseInt(tier.manualUnitPriceJpy);
                          const sellingPerPc = !isNaN(manual) && manual > 0 ? manual : result.unitPriceJpy;
                          const totalRevenue = sellingPerPc * qty;
                          const profit = totalRevenue - result.totalCostJpy;
                          return (
                            <div className="rounded-lg bg-blue-700 text-white px-4 py-3 space-y-2">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs opacity-70">Cost / pc (DDP, JPY)</p>
                                  <p className="text-2xl font-bold">¥{costPerPc.toLocaleString()}<span className="text-sm font-normal opacity-80"> / pc</span></p>
                                </div>
                                <div>
                                  <p className="text-xs opacity-70">Selling Price / pc (editable)</p>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold">¥</span>
                                    <input
                                      type="number"
                                      value={tier.manualUnitPriceJpy || result.unitPriceJpy}
                                      onChange={(e) => updateTier(tier.tier_label, "manualUnitPriceJpy", e.target.value)}
                                      className="bg-blue-800/50 border border-blue-400 rounded px-2 py-0.5 text-2xl font-bold text-white w-32 outline-none focus:border-white"
                                    />
                                    <span className="text-sm opacity-80">/ pc</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-blue-500/50 text-xs">
                                <span className="opacity-70">
                                  Margin: {tier.manualUnitPriceJpy ? `${(((sellingPerPc - costPerPc) / costPerPc) * 100).toFixed(1)}% (manual)` : `${marginValues[parseInt(tier.selectedMarginIdx)] ?? "—"}%`}
                                </span>
                                <div className="text-right">
                                  <span className="opacity-70">Revenue: </span>
                                  <span className="font-semibold">¥{totalRevenue.toLocaleString()}</span>
                                  <span className="opacity-70 ml-3">Profit: </span>
                                  <span className="font-semibold">¥{profit.toLocaleString()}</span>
                                </div>
                              </div>
                              {tier.manualUnitPriceJpy && (
                                <button
                                  type="button"
                                  onClick={() => updateTier(tier.tier_label, "manualUnitPriceJpy", "")}
                                  className="text-[10px] underline opacity-70 hover:opacity-100"
                                >
                                  Reset to calculated
                                </button>
                              )}
                            </div>
                          );
                        })()}

                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {savedAt && !error && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Saved at {new Date(savedAt).toLocaleTimeString()}. Shared settings updated globally.
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving..." : existingDDP.length > 0 ? "Update Calculation" : "Save Calculation"}
        </Button>
      </div>
    </div>
  );
}

// Small helper component for two-column label/value rows
function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right tabular-nums">{value}</span>
    </>
  );
}
