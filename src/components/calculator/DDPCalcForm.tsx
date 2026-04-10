"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { calculateDDP, formatJPY, type DDPInputs } from "@/lib/calculations";

interface ApprovedCalc {
  tier_label: string;
  quantity: number;
  estimated_cost_rmb: number | null;
  approved: boolean;
}

interface SheetData {
  outer_carton_qty?: number | null;
  outer_carton_l?: number | null;
  outer_carton_w?: number | null;
  outer_carton_h?: number | null;
  pallet_l?: number | null;
  pallet_w?: number | null;
  pallet_h?: number | null;
  cans_per_pallet?: number | null;
}

interface TierDDP {
  tier_label: string;
  quantity: string;
  rmbUnitPrice: string;
  fxRate: string;
  shippingType: "lcl" | "fcl_20ft" | "fcl_40ft" | "multi_container";
  manualShippingCostJpy: string;
  importDutyRate: string;
  consumptionTaxRate: string;
  selectedMargin: string;
  pcsPerCarton: string;
  boxL: string;
  boxW: string;
  boxH: string;
  palletL: string;
  palletW: string;
  palletH: string;
  boxesPerPallet: string;
}

function initTierDDP(calc: ApprovedCalc, sheet: SheetData): TierDDP {
  return {
    tier_label: calc.tier_label,
    quantity: String(calc.quantity),
    rmbUnitPrice: calc.estimated_cost_rmb ? String(calc.estimated_cost_rmb.toFixed(4)) : "",
    fxRate: "20",
    shippingType: "lcl",
    manualShippingCostJpy: "",
    importDutyRate: "4",
    consumptionTaxRate: "0",
    selectedMargin: "40",
    pcsPerCarton: String(sheet.outer_carton_qty ?? ""),
    boxL: String(sheet.outer_carton_l ?? ""),
    boxW: String(sheet.outer_carton_w ?? ""),
    boxH: String(sheet.outer_carton_h ?? ""),
    palletL: String(sheet.pallet_l ?? ""),
    palletW: String(sheet.pallet_w ?? ""),
    palletH: String(sheet.pallet_h ?? ""),
    boxesPerPallet: String(sheet.cans_per_pallet ? Math.ceil(sheet.cans_per_pallet / (sheet.outer_carton_qty ?? 1)) : ""),
  };
}

function buildDDPInputs(tier: TierDDP): DDPInputs | null {
  const qty = parseInt(tier.quantity);
  const rmb = parseFloat(tier.rmbUnitPrice);
  const fx = parseFloat(tier.fxRate);
  if (!qty || !rmb || !fx) return null;
  return {
    customerOrderQty: qty,
    rmbUnitPrice: rmb,
    fxRate: fx,
    pcsPerCarton: parseInt(tier.pcsPerCarton) || 1,
    boxLmm: parseFloat(tier.boxL) || 1,
    boxWmm: parseFloat(tier.boxW) || 1,
    boxHmm: parseFloat(tier.boxH) || 1,
    palletLmm: parseFloat(tier.palletL) || 1200,
    palletWmm: parseFloat(tier.palletW) || 1000,
    palletHmm: parseFloat(tier.palletH) || 1100,
    boxesPerPallet: parseInt(tier.boxesPerPallet) || 1,
    shippingType: tier.shippingType,
    manualShippingCostJpy: tier.manualShippingCostJpy ? parseInt(tier.manualShippingCostJpy) : undefined,
    importDutyRate: parseFloat(tier.importDutyRate) / 100,
    consumptionTaxRate: parseFloat(tier.consumptionTaxRate) / 100,
    selectedMargin: parseFloat(tier.selectedMargin) / 100,
  };
}

const MARGIN_OPTIONS = [60, 55, 50, 45, 40, 35, 30, 25];
const SHIPPING_TYPES = [
  { value: "lcl", label: "LCL (auto-calculate)" },
  { value: "fcl_20ft", label: "20ft FCL (¥250,000)" },
  { value: "fcl_40ft", label: "40ft FCL (¥400,000)" },
  { value: "multi_container", label: "Multiple Containers (manual)" },
];

export default function DDPCalcForm({
  locale,
  quoteId,
  approvedCalcs,
  sheet,
  existingDDP,
}: {
  locale: string;
  quoteId: string;
  approvedCalcs: ApprovedCalc[];
  sheet: Record<string, unknown>;
  existingDDP: Record<string, unknown>[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTier, setActiveTier] = useState(approvedCalcs[0]?.tier_label ?? "");

  const [tiers, setTiers] = useState<TierDDP[]>(() =>
    approvedCalcs.map((c) => initTierDDP(c, sheet as SheetData))
  );

  const updateTier = (index: number, field: keyof TierDDP, value: string) => {
    setTiers(tiers.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const tiersPayload = tiers.map((tier) => {
        const inputs = buildDDPInputs(tier);
        if (!inputs) throw new Error(`Tier ${tier.tier_label}: missing required fields`);
        return { ...inputs, tier_label: tier.tier_label };
      });

      const res = await fetch("/api/ddp-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotation_id: quoteId,
          tiers: tiersPayload,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      router.push(`/${locale}/quotes/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing DDP warning */}
      {existingDDP.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          DDP calculations already exist for this quote. Saving will create a new version.
        </div>
      )}

      {/* Shared logistics header */}
      <Card>
        <CardHeader><CardTitle className="text-base">Shared Logistics & FX Settings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-4">These defaults apply to all tiers — override per-tier below if needed.</p>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">FX Rate (1 RMB = X JPY)</Label>
              <Input
                type="number"
                step="0.01"
                value={tiers[0]?.fxRate ?? "20"}
                onChange={(e) => {
                  const v = e.target.value;
                  setTiers(tiers.map((t) => ({ ...t, fxRate: v })));
                }}
                placeholder="20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Import Duty %</Label>
              <Input
                type="number"
                step="0.1"
                value={tiers[0]?.importDutyRate ?? "4"}
                onChange={(e) => {
                  const v = e.target.value;
                  setTiers(tiers.map((t) => ({ ...t, importDutyRate: v })));
                }}
                placeholder="4"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Consumption Tax %</Label>
              <Input
                type="number"
                step="0.1"
                value={tiers[0]?.consumptionTaxRate ?? "0"}
                onChange={(e) => {
                  const v = e.target.value;
                  setTiers(tiers.map((t) => ({ ...t, consumptionTaxRate: v })));
                }}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Pcs per Carton</Label>
              <Input
                type="number"
                value={tiers[0]?.pcsPerCarton ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setTiers(tiers.map((t) => ({ ...t, pcsPerCarton: v })));
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier tabs */}
      <div className="flex gap-2">
        {tiers.map((tier) => (
          <button
            key={tier.tier_label}
            type="button"
            onClick={() => setActiveTier(tier.tier_label)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              activeTier === tier.tier_label
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Tier {tier.tier_label}
          </button>
        ))}
      </div>

      {tiers.map((tier, i) => {
        if (tier.tier_label !== activeTier) return null;
        const inputs = buildDDPInputs(tier);
        const result = inputs ? calculateDDP(inputs) : null;

        return (
          <div key={tier.tier_label} className="space-y-4">
            {/* Inputs */}
            <Card>
              <CardHeader><CardTitle className="text-base">Tier {tier.tier_label} — Inputs</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Order Qty (pcs)</Label>
                    <Input type="number" value={tier.quantity} onChange={(e) => updateTier(i, "quantity", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">RMB Unit Price (from Wilfred)</Label>
                    <Input type="number" step="0.0001" value={tier.rmbUnitPrice} onChange={(e) => updateTier(i, "rmbUnitPrice", e.target.value)} className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">FX Rate (1 RMB = ? JPY)</Label>
                    <Input type="number" step="0.01" value={tier.fxRate} onChange={(e) => updateTier(i, "fxRate", e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Shipping Type</Label>
                    <Select value={tier.shippingType} onValueChange={(v) => v && updateTier(i, "shippingType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHIPPING_TYPES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(tier.shippingType === "multi_container" || tier.shippingType === "fcl_20ft" || tier.shippingType === "fcl_40ft") && (
                    <div className="space-y-2">
                      <Label className="text-xs">Manual Shipping Cost (JPY) — override</Label>
                      <Input type="number" value={tier.manualShippingCostJpy} onChange={(e) => updateTier(i, "manualShippingCostJpy", e.target.value)} placeholder="leave blank for default FCL rate" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Result */}
            {result && (
              <Card className="border-blue-200">
                <CardHeader><CardTitle className="text-base text-blue-800">Calculation Result</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {/* Logistics */}
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Cartons ordered</p>
                      <p className="font-semibold">{result.cartonsOrdered.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Factory production qty</p>
                      <p className="font-semibold">{result.factoryProductionQty.toLocaleString()} pcs</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Pallets</p>
                      <p className="font-semibold">{result.pallets}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total CBM</p>
                      <p className="font-semibold">{result.totalCBM} m³</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Cost breakdown */}
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Manufacturing</p>
                      <p className="font-semibold">{formatJPY(result.manufacturingCostJpy)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Shipping</p>
                      <p className="font-semibold">{formatJPY(result.shippingCostJpy)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Import Duty ({tier.importDutyRate}%)</p>
                      <p className="font-semibold">{formatJPY(result.importDutyJpy)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Cost (DDP base)</p>
                      <p className="text-lg font-bold text-blue-800">{formatJPY(result.totalCostJpy)}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Margin table */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-3">Margin Options</p>
                    <div className="grid grid-cols-4 gap-2">
                      {result.marginOptions.map((opt) => {
                        const pct = Math.round(opt.margin * 100);
                        const isSelected = String(pct) === tier.selectedMargin;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => updateTier(i, "selectedMargin", String(pct))}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              isSelected
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <p className={`text-xs font-semibold ${isSelected ? "text-blue-700" : "text-gray-500"}`}>
                              {pct}% margin
                            </p>
                            <p className={`text-sm font-bold ${isSelected ? "text-blue-800" : "text-gray-800"}`}>
                              {formatJPY(opt.unitPrice)}/pc
                            </p>
                            <p className="text-xs text-gray-400">{formatJPY(opt.total)}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected summary */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-blue-700 text-white">
                    <div>
                      <p className="text-sm opacity-80">Selected: {tier.selectedMargin}% margin</p>
                      <p className="text-2xl font-bold">{formatJPY(result.unitPriceJpy)} / pc</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm opacity-80">Total revenue</p>
                      <p className="text-xl font-semibold">{formatJPY(result.totalRevenueJpy)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
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
