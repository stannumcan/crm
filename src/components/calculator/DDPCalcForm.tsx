"use client";

import { useState } from "react";
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
  moldCostNew: number | null;
  moldCostModify: number | null;
  moldLeadTime: number | null;
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
}

interface ApprovedCalc {
  tier_label: string;
  quantity: number;
  quantity_type: string;
  estimated_cost_rmb: number | null;
}

interface TierState {
  tier_label: string;
  quantity: string;
  rmbUnitPrice: string;
  shippingType: "lcl" | "fcl_20ft" | "fcl_40ft" | "multi_container";
  manualShippingCostJpy: string;
  selectedMargin: string;
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function autoShippingType(quantityType: string): TierState["shippingType"] {
  if (quantityType === "fcl_20ft") return "fcl_20ft";
  if (quantityType === "fcl_40ft") return "fcl_40ft";
  return "lcl";
}

function initTier(calc: ApprovedCalc): TierState {
  return {
    tier_label: calc.tier_label,
    quantity: String(calc.quantity ?? ""),
    rmbUnitPrice: calc.estimated_cost_rmb != null ? calc.estimated_cost_rmb.toFixed(4) : "",
    shippingType: autoShippingType(calc.quantity_type),
    manualShippingCostJpy: "",
    selectedMargin: "40",
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
  };
}

const SHIPPING_LABELS: Record<string, string> = {
  lcl: "LCL (auto-calculated)",
  fcl_20ft: "20ft FCL (¥250,000)",
  fcl_40ft: "40ft FCL (¥400,000)",
  multi_container: "Multiple containers (manual)",
};

const ALL_MARGINS = [60, 55, 50, 45, 40, 35, 30, 25];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DDPCalcForm({
  locale,
  quoteId,
  quoteInfo,
  packagingDefaults,
  approvedCalcs,
  existingDDP,
}: {
  locale: string;
  quoteId: string;
  quoteInfo: QuoteInfo;
  packagingDefaults: PackagingDefaults;
  approvedCalcs: ApprovedCalc[];
  existingDDP: Record<string, unknown>[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(approvedCalcs[0]?.tier_label ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Shared settings
  const [fxRate, setFxRate] = useState("20");
  const [importDutyRate, setImportDutyRate] = useState("4");
  const [consumptionTaxRate, setConsumptionTaxRate] = useState("0");

  // Packaging (auto-filled, editable)
  const [pkg, setPkg] = useState<PackagingState>(() => initPackaging(packagingDefaults));
  const updatePkg = (field: keyof PackagingState, value: string) =>
    setPkg((prev) => ({ ...prev, [field]: value }));

  // Per-tier state
  const [tiers, setTiers] = useState<TierState[]>(() => approvedCalcs.map(initTier));
  const updateTier = (label: string, field: keyof TierState, value: string) =>
    setTiers((prev) => prev.map((t) => t.tier_label === label ? { ...t, [field]: value } : t));

  // Build calc result for a tier
  function calcTier(tier: TierState) {
    const qty = parseInt(tier.quantity);
    const rmb = parseFloat(tier.rmbUnitPrice);
    const fx = parseFloat(fxRate);
    const pcs = parseInt(pkg.pcsPerCarton);
    const bpp = parseInt(pkg.boxesPerPallet);
    if (!qty || !rmb || !fx || !pcs || !bpp) return null;
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
      shippingType: tier.shippingType,
      manualShippingCostJpy: tier.manualShippingCostJpy ? parseInt(tier.manualShippingCostJpy) : undefined,
      importDutyRate: parseFloat(importDutyRate) / 100,
      consumptionTaxRate: parseFloat(consumptionTaxRate) / 100,
      selectedMargin: parseFloat(tier.selectedMargin) / 100,
    });
  }

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
          shippingType: tier.shippingType,
          manualShippingCostJpy: tier.manualShippingCostJpy ? parseInt(tier.manualShippingCostJpy) : undefined,
          importDutyRate: parseFloat(importDutyRate) / 100,
          consumptionTaxRate: parseFloat(consumptionTaxRate) / 100,
          selectedMargin: parseFloat(tier.selectedMargin) / 100,
        };
      });

      const res = await fetch("/api/ddp-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotation_id: quoteId, tiers: tiersPayload }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      router.push(`/${locale}/quotes/${quoteId}`);
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
            {quoteInfo.moldNumber && <span><span className="text-gray-400 text-xs">Mold</span><br /><span className="font-mono font-medium">{quoteInfo.moldNumber}</span></span>}
            {quoteInfo.moldCostNew != null && <span><span className="text-gray-400 text-xs">New Mold</span><br /><span className="font-medium">¥{quoteInfo.moldCostNew.toLocaleString()} RMB</span></span>}
            {quoteInfo.moldCostModify != null && <span><span className="text-gray-400 text-xs">Adj. Cost</span><br /><span className="font-medium">¥{quoteInfo.moldCostModify.toLocaleString()} RMB</span></span>}
            {quoteInfo.moldLeadTime != null && <span><span className="text-gray-400 text-xs">Lead Time</span><br /><span className="font-medium">{quoteInfo.moldLeadTime} days</span></span>}
          </div>
        </CardContent>
      </Card>

      {/* ── Shared Settings + Packaging ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        {/* Shared currency / tax */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Shared Settings</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 mb-3">Apply to all tiers</p>
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Per-Tier Tabs ─────────────────────────────────────────── */}
      <div>
        {/* Tab buttons */}
        {tiers.length > 1 && (
          <div className="flex gap-2 mb-4">
            {tiers.map((tier) => (
              <button
                key={tier.tier_label}
                type="button"
                onClick={() => setActiveTab(tier.tier_label)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  activeTab === tier.tier_label
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Tier {tier.tier_label}
              </button>
            ))}
          </div>
        )}

        {tiers.map((tier) => {
          if (tier.tier_label !== activeTab) return null;
          const result = calcTier(tier);
          const qty = parseInt(tier.quantity) || 0;

          return (
            <div key={tier.tier_label}>
              <div className="grid grid-cols-5 gap-5 mt-2">

                {/* Left: inputs (2/5) */}
                <div className="col-span-2 space-y-4">
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Tier {tier.tier_label} — Inputs</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Customer Order Qty (pcs)</Label>
                        <Input
                          type="number"
                          value={tier.quantity}
                          onChange={(e) => updateTier(tier.tier_label, "quantity", e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Manufacturing Unit Price (RMB/pc)</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={tier.rmbUnitPrice}
                          onChange={(e) => updateTier(tier.tier_label, "rmbUnitPrice", e.target.value)}
                          className="font-mono"
                        />
                        <p className="text-xs text-gray-400">Auto-filled from Wilfred calc</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Shipping Type</Label>
                        <Select
                          value={tier.shippingType}
                          onValueChange={(v) => v && updateTier(tier.tier_label, "shippingType", v)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(SHIPPING_LABELS).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {(tier.shippingType === "multi_container" || tier.shippingType === "fcl_20ft" || tier.shippingType === "fcl_40ft") && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Manual Shipping Cost (JPY)</Label>
                          <Input
                            type="number"
                            value={tier.manualShippingCostJpy}
                            onChange={(e) => updateTier(tier.tier_label, "manualShippingCostJpy", e.target.value)}
                            placeholder="Leave blank for default FCL rate"
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
                            <Row label="+5% buffer qty" value={`${(qty * 1.05).toLocaleString(undefined, { maximumFractionDigits: 0 })} pcs`} />
                            <Row label="Cartons ordered" value={result.cartonsOrdered.toLocaleString()} />
                            <Row label="Factory production qty" value={`${result.factoryProductionQty.toLocaleString()} pcs`} />
                            <Row label="Pallets" value={result.pallets.toLocaleString()} />
                            <Row label="Total CBM" value={`${result.totalCBM} m³`} />
                          </div>
                        </div>

                        <Separator />

                        {/* Costs */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cost Breakdown</p>
                          <div className="space-y-1 text-sm">
                            <Row label="Manufacturing" value={formatJPY(result.manufacturingCostJpy)} />
                            <Row label={`Shipping (${tier.shippingType === "lcl" ? "LCL auto" : SHIPPING_LABELS[tier.shippingType]})`} value={formatJPY(result.shippingCostJpy)} />
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
                            {result.marginOptions.map((opt) => {
                              const pct = Math.round(opt.margin * 100);
                              const isSelected = String(pct) === tier.selectedMargin;
                              return (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => updateTier(tier.tier_label, "selectedMargin", String(pct))}
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
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Selected price banner */}
                        <div className="flex items-center justify-between rounded-lg bg-blue-700 text-white px-4 py-3">
                          <div>
                            <p className="text-xs opacity-70">Selected: {tier.selectedMargin}% margin</p>
                            <p className="text-2xl font-bold">{formatJPY(result.unitPriceJpy)}<span className="text-sm font-normal opacity-80"> / pc</span></p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs opacity-70">Total revenue</p>
                            <p className="text-lg font-semibold">{formatJPY(result.totalRevenueJpy)}</p>
                          </div>
                        </div>

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

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/quotes/${quoteId}`)}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving..." : "Save DDP & Mark as Sent"}
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
