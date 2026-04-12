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
}: {
  locale: string;
  quoteId: string;
  costSheetId: string;
  factoryTiers: FactoryTier[];
  existingCalcs: ExistingCalc[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const [rows, setRows] = useState<TierRow[]>(() =>
    factoryTiers.map((tier) => {
      const existing = existingCalcs.find((c) => c.tier_label === tier.tier_label);
      return initRow(tier, existing);
    })
  );

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
      // Update rows with returned IDs
      setRows(rows.map((r) => {
        const s = saved.find((c) => c.tier_label === r.tier_label);
        return s ? { ...r, existingId: s.id, approved: s.approved } : r;
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (rowIndex: number) => {
    const row = rows[rowIndex];
    if (!row.existingId) return;
    setApproving(row.existingId);
    try {
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
      if (!res.ok) throw new Error("Failed to approve");
      setRows(rows.map((r, i) => i === rowIndex ? { ...r, approved: true } : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setApproving(null);
    }
  };

  const allApproved = rows.every((r) => r.approved) && editing.size === 0;

  return (
    <div className="space-y-4">
      {/* Formula reference */}
      <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        <strong>Formula:</strong> (总成本合计 + 人工 + 配件 + 人工×overhead) × (1 + margin%)
      </div>

      {rows.map((row, i) => {
        const estimate = calcEstimate(row);
        const isApproved = row.approved;
        const isEditing = editing.has(row.tier_label);
        const isLocked = isApproved && !isEditing;
        return (
          <Card key={row.tier_label} className={isApproved && !isEditing ? "border-green-300" : isEditing ? "border-amber-300" : ""}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="text-base">{row.quantity.toLocaleString()} pcs</CardTitle>
                </div>
              </div>
              {isApproved && !isEditing ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-green-500 text-green-700 gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approved
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    title="Edit"
                    onClick={() => setEditing((prev) => new Set(prev).add(row.tier_label))}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ) : isEditing ? (
                <Badge variant="outline" className="border-amber-400 text-amber-700 gap-1">
                  <Pencil className="h-3.5 w-3.5" />
                  Editing
                </Badge>
              ) : (
                estimate !== null && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Estimated unit cost</p>
                    <p className="text-lg font-bold text-gray-800">{formatRMB(estimate)}</p>
                  </div>
                )
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">总成本合计 (RMB/pc)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={row.total_subtotal}
                    onChange={(e) => updateRow(i, "total_subtotal", e.target.value)}
                    disabled={isLocked}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">人工 Labor (RMB/pc)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={row.labor_cost}
                    onChange={(e) => updateRow(i, "labor_cost", e.target.value)}
                    disabled={isLocked}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">配件 Accessories (RMB/pc)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={row.accessories_cost}
                    onChange={(e) => updateRow(i, "accessories_cost", e.target.value)}
                    disabled={isLocked}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Overhead Multiplier (×labor)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={row.overhead_multiplier}
                    onChange={(e) => updateRow(i, "overhead_multiplier", e.target.value)}
                    disabled={isLocked}
                    className="font-mono"
                    placeholder="1.0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Margin %</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={row.margin_rate}
                    onChange={(e) => updateRow(i, "margin_rate", e.target.value)}
                    disabled={isLocked}
                    className="font-mono"
                    placeholder="20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    value={row.wilfred_notes}
                    onChange={(e) => updateRow(i, "wilfred_notes", e.target.value)}
                    disabled={isLocked}
                    placeholder="optional"
                  />
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

              {(!isApproved || isEditing) && row.existingId && (
                <div className="flex justify-end mt-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-green-500 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      handleApprove(i);
                      setEditing((prev) => { const next = new Set(prev); next.delete(row.tier_label); return next; });
                    }}
                    disabled={approving === row.existingId}
                  >
                    {approving === row.existingId ? "Approving..." : isEditing ? "Save & Re-approve" : "Approve Tier"}
                  </Button>
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

      {allApproved ? (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 text-center">
          All tiers approved — status updated to Pending Natsuki.
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
          <Button type="button" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Calculations"}
          </Button>
        </div>
      )}
    </div>
  );
}
