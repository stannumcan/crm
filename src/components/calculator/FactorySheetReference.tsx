"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Factory } from "lucide-react";

interface PrintingLine { surface: string; part: string; spec: string }
interface EmbossingLine { component: string; cost_rmb: string; notes: string }
interface PackagingLine { type: string; config: string; l: number; w: number; h: number; cbm: number; tins: number }
interface TierCost { tier_label: string; quantity: number; total_subtotal: number | null; labor_cost: number | null; accessories_cost: number | null }

// Canonical key → display label maps (duplicated here to avoid server/client import issues)
const SURFACE_MAP: Record<string, string> = { outside: "Outside", inside: "Inside", "外面": "Outside", "内面": "Inside" };
const PART_MAP: Record<string, string> = { lid: "Lid", body: "Body", bottom: "Bottom", lid_body: "Lid & Body", lid_body_bottom: "Lid, Body & Bottom", "蓋": "Lid", "身": "Body", "底": "Bottom" };

function fmtRmb(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `¥${n.toLocaleString()} RMB`;
}

function fmtRmbUnit(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `¥${n.toFixed(4)}/pc`;
}

export interface FactorySheetRefData {
  moldNumber: string | null;
  productDimensions: string | null;
  steelThickness: number | null;
  version: number;
  moldCostNew: number | null;
  moldCostModify: number | null;
  moldLeadTimeDays: number | null;
  moldImageUrl: string | null;
  printingLines: PrintingLine[] | null;
  embossingLines: EmbossingLine[] | null;
  packagingLines: PackagingLine[] | null;
  tierCosts: TierCost[];
}

export default function FactorySheetReference({ data }: { data: FactorySheetRefData }) {
  const [expanded, setExpanded] = useState(false);

  const {
    moldNumber, productDimensions, steelThickness, version,
    moldCostNew, moldCostModify, moldLeadTimeDays, moldImageUrl,
    printingLines, embossingLines, packagingLines, tierCosts,
  } = data;

  return (
    <div className="rounded-lg border" style={{ borderColor: "oklch(0.85 0.04 230)", background: "oklch(0.98 0.005 230)" }}>
      {/* Header — always visible */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 shrink-0" style={{ color: "oklch(0.55 0.10 230)" }} />
          <span className="text-sm font-medium">Factory Sheet Reference</span>
          <span className="text-xs text-muted-foreground font-mono">
            {moldNumber ?? "—"} · {productDimensions ?? "—"} · {steelThickness ? `${steelThickness}mm` : "—"} · v{version}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "oklch(0.88 0.04 230)" }}>
          <div className="flex gap-4">
            {/* Left: details */}
            <div className="flex-1 space-y-3">
              {/* Printing */}
              {printingLines && printingLines.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Printing</p>
                  <div className="space-y-0.5">
                    {printingLines.map((ln, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-muted-foreground">{SURFACE_MAP[ln.surface] ?? ln.surface} / {PART_MAP[ln.part] ?? ln.part}: </span>
                        <span>{ln.spec || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Embossing */}
              {embossingLines && embossingLines.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Embossing</p>
                  <div className="space-y-0.5">
                    {embossingLines.map((ln, i) => (
                      <div key={i} className="text-xs">
                        <span>{ln.component || "Embossing"}</span>
                        {ln.cost_rmb && <span className="text-muted-foreground ml-2">¥{ln.cost_rmb} RMB</span>}
                        {ln.notes && <span className="text-muted-foreground ml-2">— {ln.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mold Costs */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Mold Costs</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span>New: <strong>{fmtRmb(moldCostNew)}</strong></span>
                  <span>Adjust: <strong>{fmtRmb(moldCostModify)}</strong></span>
                  {moldLeadTimeDays && <span>Lead: <strong>{moldLeadTimeDays} days</strong></span>}
                </div>
              </div>

              {/* Packaging */}
              {packagingLines && packagingLines.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Packaging</p>
                  <div className="space-y-0.5">
                    {packagingLines.map((p, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-medium">{p.type}</span>
                        {p.config && <span className="text-muted-foreground ml-2">{p.config}</span>}
                        {p.l && p.w && p.h && <span className="text-muted-foreground ml-2">{p.l}×{p.w}×{p.h}mm</span>}
                        {p.cbm && <span className="text-muted-foreground ml-2">{p.cbm} m³</span>}
                        {p.tins && <span className="text-muted-foreground ml-2">{p.tins} tins</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tier Costs */}
              {tierCosts.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Cost per Tier</p>
                  <table className="text-xs w-full max-w-md">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left font-medium pr-3 pb-0.5">Tier</th>
                        <th className="text-left font-medium pr-3 pb-0.5">Qty</th>
                        <th className="text-left font-medium pr-3 pb-0.5">Total</th>
                        <th className="text-left font-medium pr-3 pb-0.5">Labor</th>
                        <th className="text-left font-medium pb-0.5">Accessories</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tierCosts.map((t) => (
                        <tr key={t.tier_label}>
                          <td className="pr-3 py-0.5 font-medium">{t.tier_label}</td>
                          <td className="pr-3 py-0.5">{t.quantity?.toLocaleString() ?? "—"}</td>
                          <td className="pr-3 py-0.5 font-mono">{fmtRmbUnit(t.total_subtotal)}</td>
                          <td className="pr-3 py-0.5 font-mono">{fmtRmbUnit(t.labor_cost)}</td>
                          <td className="py-0.5 font-mono">{fmtRmbUnit(t.accessories_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: mold image */}
            {moldImageUrl && (
              <div className="shrink-0">
                <img
                  src={moldImageUrl.startsWith("/") ? moldImageUrl : moldImageUrl}
                  alt={`Mold ${moldNumber}`}
                  className="rounded-md border bg-white object-contain"
                  style={{ maxWidth: "160px", maxHeight: "160px" }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
