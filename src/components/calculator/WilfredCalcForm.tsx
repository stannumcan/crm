"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Pencil } from "lucide-react";
import { calculateWilfredCost, formatRMB } from "@/lib/calculations";
import { StaleWarning, VersionBadge } from "@/components/ui/version-badge";
import VersionHistory from "@/components/ui/version-history";
import FactorySheetReference, { type FactorySheetRefData } from "@/components/calculator/FactorySheetReference";

interface FactoryTier {
  id: string;
  tier_label: string;
  quantity: number;
  total_subtotal: number | null;
  labor_cost: number | null;
  accessories_cost: number | null;
  container_info: string | null;
}

interface ExistingCalc {
  id: string;
  tier_label: string;
  total_subtotal: number;
  labor_cost: number;
  accessories_cost: number;
  overhead_multiplier: number;
  margin_rate: number;
  estimated_cost_rmb: number | null;
  approved: boolean;
  wilfred_notes: string | null;
}

interface TierRow {
  tier_label: string;
  quantity: number;
  total_subtotal: string;
  labor_cost: string;
  accessories_cost: string;
  overhead_multiplier: string;
  margin_rate: string;
  wilfred_notes: string;
  existingId?: string;
  approved?: boolean;
}

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

function initRow(tier: FactoryTier, existing?: ExistingCalc): TierRow {
  return {
    tier_label: tier.tier_label,
    quantity: tier.quantity,
    total_subtotal: existing ? String(existing.total_subtotal) : String(tier.total_subtotal ?? ""),
    labor_cost: existing ? String(existing.labor_cost) : String(tier.labor_cost ?? ""),
    accessories_cost: existing ? String(existing.accessories_cost) : String(tier.accessories_cost ?? ""),
    overhead_multiplier: existing ? String(existing.overhead_multiplier) : "1.0",
    margin_rate: existing ? String(Math.round(existing.margin_rate * 100)) : "20",
    wilfred_notes: existing?.wilfred_notes ?? "",
    existingId: existing?.id,
    approved: existing?.approved ?? false,
  };
}

function calcEstimate(row: TierRow): number | null {
  const sub = parseFloat(row.total_subtotal);
  const lab = parseFloat(row.labor_cost);
  const acc = parseFloat(row.accessories_cost);
  const ovh = parseFloat(row.overhead_multiplier);
  const mar = parseFloat(row.margin_rate) / 100;
  if (isNaN(sub) || isNaN(lab) || isNaN(acc)) return null;
  return calculateWilfredCost({
    totalSubtotal: sub,
    laborCost: lab,
    accessoriesCost: acc,
    overheadMultiplier: isNaN(ovh) ? 1.0 : ovh,
    marginRate: isNaN(mar) ? 0.2 : mar,
  });
}

export default function WilfredCalcForm({
  locale,
  quoteId,
  costSheetId,
  factoryTiers,
  existingCalcs,
  fees,
  sheetVersion,
  wilfredVersion,
  basedOnSheetVersion,
  sheetRef,
}: {
  locale: string;
  quoteId: string;
  costSheetId: string;
  factoryTiers: FactoryTier[];
  existingCalcs: ExistingCalc[];
  fees?: FeesData;
  sheetVersion?: number;
  wilfredVersion?: number;
  basedOnSheetVersion?: number;
  sheetRef?: FactorySheetRefData;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");

  // Fees state
  const totalEmbossingFromFactory = (fees?.embossingLines ?? [])
    .reduce((sum, ln) => sum + (parseFloat(ln.cost_rmb) || 0), 0);
  const [feeEmbossing, setFeeEmbossing] = useState(
    String(fees?.wilfredEmbossingCost ?? (totalEmbossingFromFactory || ""))
  );
  const [feeMoldNew, setFeeMoldNew] = useState(
    String(fees?.wilfredMoldCostNew ?? fees?.moldCostNew ?? "")
  );
  const [feeMoldAdjust, setFeeMoldAdjust] = useState(
    String(fees?.wilfredMoldCostAdjust ?? fees?.moldCostAdjust ?? "")
  );
  const [feeNotes, setFeeNotes] = useState(fees?.feesNotes ?? "");

  const [rows, setRows] = useState<TierRow[]>(() =>
    factoryTiers.map((tier) => {
      const existing = existingCalcs.find((c) => c.tier_label === tier.tier_label);
      return initRow(tier, existing);
    })
  );

  // Determine if everything is already approved
  const allSaved = rows.every((r) => r.existingId);
  const allTiersApproved = rows.every((r) => r.approved);
  const feesApproved = fees?.feesApproved ?? false;
  const allApproved = allTiersApproved && feesApproved && !isEditing;

  const isLocked = allApproved && !isEditing;

  const updateRow = (index: number, field: keyof TierRow, value: string) => {
    setRows(rows.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wilfred-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cost_sheet_id: costSheetId,
          tiers: rows.map((r) => ({
            tier_label: r.tier_label,
            quantity: r.quantity,
            total_subtotal: parseFloat(r.total_subtotal) || 0,
            labor_cost: parseFloat(r.labor_cost) || 0,
            accessories_cost: parseFloat(r.accessories_cost) || 0,
            overhead_multiplier: parseFloat(r.overhead_multiplier) || 1.0,
            margin_rate: (parseFloat(r.margin_rate) || 20) / 100,
            wilfred_notes: r.wilfred_notes || null,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      const saved = await res.json() as ExistingCalc[];
      setRows(rows.map((r) => {
        const s = saved.find((c) => c.tier_label === r.tier_label);
        return s ? { ...r, existingId: s.id, approved: s.approved } : r;
      }));
      // Refresh server data so tab switches show up-to-date state
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async () => {
    setApproving(true);
    setError("");
    try {
      // Save/approve all tiers
      for (const row of rows) {
        if (!row.existingId) continue;
        const res = await fetch("/api/wilfred-calc", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.existingId,
            approved: true,
            wilfred_notes: row.wilfred_notes || null,
            margin_rate: (parseFloat(row.margin_rate) || 20) / 100,
            overhead_multiplier: parseFloat(row.overhead_multiplier) || 1.0,
            total_subtotal: parseFloat(row.total_subtotal) || 0,
            labor_cost: parseFloat(row.labor_cost) || 0,
            accessories_cost: parseFloat(row.accessories_cost) || 0,
          }),
        });
        if (!res.ok) throw new Error("Failed to approve tier " + row.tier_label);
      }

      // Save fees
      const feeRes = await fetch("/api/factory-sheets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: costSheetId,
          wilfred_embossing_cost: parseFloat(feeEmbossing) || null,
          wilfred_mold_cost_new: parseFloat(feeMoldNew) || null,
          wilfred_mold_cost_adjust: parseFloat(feeMoldAdjust) || null,
          wilfred_fees_approved: true,
          wilfred_fees_notes: feeNotes || null,
        }),
      });
      if (!feeRes.ok) throw new Error("Failed to save fees");

      // Update local state
      setRows(rows.map((r) => ({ ...r, approved: true })));
      setIsEditing(false);
      // Refresh server data so tab switches show up-to-date state
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Sticky sidebar — factory sheet reference */}
      {sheetRef && (
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto rounded-lg border p-4"
            style={{ borderColor: "oklch(0.88 0.04 230)", background: "oklch(0.98 0.005 230)" }}
          >
            <FactorySheetReference data={sheetRef} />
          </div>
        </aside>
      )}

      {/* Main form */}
      <div className="flex-1 min-w-0 space-y-4">
      {/* Formula reference + version info */}
      <div className="flex items-center justify-between">
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 flex-1">
          <strong>Formula:</strong> (总成本合计 + 人工 + 配件 + 人工×overhead) × (1 + margin%)
        </div>
        <div className="flex items-center gap-2 ml-3">
          {wilfredVersion && <VersionBadge version={wilfredVersion} isStale={!!basedOnSheetVersion && !!sheetVersion && basedOnSheetVersion < sheetVersion} />}
          <VersionHistory
            entityType="wilfred_calculation"
            queryParams={{ cost_sheet_id: costSheetId }}
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
      </div>

      {/* Stale warning */}
      {basedOnSheetVersion && sheetVersion && basedOnSheetVersion < sheetVersion && (
        <StaleWarning entityName="Factory Sheet" basedOnVersion={basedOnSheetVersion} currentVersion={sheetVersion} />
      )}

      {/* Status bar */}
      {allApproved && (
        <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">All approved</span>
          </div>
          <Button
            type="button" size="sm" variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      )}

      {isEditing && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700 flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5" /> Editing — make changes and click "Save & Approve All" when done.
        </div>
      )}

      {/* Fees section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Fees</CardTitle>
            {fees?.embossingLines && fees.embossingLines.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Factory: {fees.embossingLines.map((ln) => `${ln.component} ¥${ln.cost_rmb || 0}`).join(", ")}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Embossing Cost (RMB)</Label>
              <Input
                type="number" step="0.01" value={feeEmbossing}
                onChange={(e) => setFeeEmbossing(e.target.value)}
                disabled={isLocked} className="font-mono" placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New Mold Cost (RMB)</Label>
              <Input
                type="number" step="0.01" value={feeMoldNew}
                onChange={(e) => setFeeMoldNew(e.target.value)}
                disabled={isLocked} className="font-mono" placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mold Adjustment (RMB)</Label>
              <Input
                type="number" step="0.01" value={feeMoldAdjust}
                onChange={(e) => setFeeMoldAdjust(e.target.value)}
                disabled={isLocked} className="font-mono" placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input
                value={feeNotes} onChange={(e) => setFeeNotes(e.target.value)}
                disabled={isLocked} placeholder="Optional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier cards */}
      {rows.map((row, i) => {
        const estimate = calcEstimate(row);
        return (
          <Card key={row.tier_label}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">{row.quantity.toLocaleString()} pcs</CardTitle>
              {estimate !== null && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Estimated unit cost</p>
                  <p className="text-lg font-bold text-gray-800">{formatRMB(estimate)}</p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">总成本合计 (RMB/pc)</Label>
                  <Input type="number" step="0.0001" value={row.total_subtotal}
                    onChange={(e) => updateRow(i, "total_subtotal", e.target.value)}
                    disabled={isLocked} className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">人工 Labor (RMB/pc)</Label>
                  <Input type="number" step="0.0001" value={row.labor_cost}
                    onChange={(e) => updateRow(i, "labor_cost", e.target.value)}
                    disabled={isLocked} className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">配件 Accessories (RMB/pc)</Label>
                  <Input type="number" step="0.0001" value={row.accessories_cost}
                    onChange={(e) => updateRow(i, "accessories_cost", e.target.value)}
                    disabled={isLocked} className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Overhead Multiplier (×labor)</Label>
                  <Input type="number" step="0.1" value={row.overhead_multiplier}
                    onChange={(e) => updateRow(i, "overhead_multiplier", e.target.value)}
                    disabled={isLocked} className="font-mono" placeholder="1.0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Margin %</Label>
                  <Input type="number" step="1" min="0" max="100" value={row.margin_rate}
                    onChange={(e) => updateRow(i, "margin_rate", e.target.value)}
                    disabled={isLocked} className="font-mono" placeholder="20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Input value={row.wilfred_notes}
                    onChange={(e) => updateRow(i, "wilfred_notes", e.target.value)}
                    disabled={isLocked} placeholder="optional" />
                </div>
              </div>

              {/* Live result breakdown */}
              {estimate !== null && (
                <div className="flex items-center gap-6 px-3 py-2 rounded bg-gray-50 text-xs text-gray-600">
                  <span>Sub: {formatRMB(parseFloat(row.total_subtotal) || 0)}</span>
                  <span>+</span>
                  <span>Labor: {formatRMB(parseFloat(row.labor_cost) || 0)}</span>
                  <span>+</span>
                  <span>Acc: {formatRMB(parseFloat(row.accessories_cost) || 0)}</span>
                  <span>+</span>
                  <span>OH: {formatRMB((parseFloat(row.labor_cost) || 0) * (parseFloat(row.overhead_multiplier) || 1))}</span>
                  <span>=</span>
                  <span className="font-bold text-gray-800">→ {formatRMB(estimate)} / pc</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {allApproved && !isEditing ? (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 text-center">
          All approved — status updated to Pending DDP.
          <div className="mt-3">
            <Button onClick={() => router.push(`/${locale}/quotes/${quoteId}`)}>
              Back to Quote
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/quotes/${quoteId}`)}>
            Cancel
          </Button>
          {!allSaved ? (
            <Button type="button" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Calculations"}
            </Button>
          ) : (
            <Button type="button" onClick={handleApproveAll} disabled={approving}
              className="bg-green-600 hover:bg-green-700"
            >
              {approving ? "Approving..." : isEditing ? "Save & Approve All" : "Approve All"}
            </Button>
          )}
        </div>
      )}
      </div>{/* end flex-1 main form */}
    </div>
  );
}
