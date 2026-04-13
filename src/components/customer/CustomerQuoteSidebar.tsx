"use client";

import { Factory, Calculator, Truck } from "lucide-react";

interface PrintingLine { surface: string; part: string; spec: string }
interface PackagingLine { type: string; config: string; l: number; w: number; h: number; cbm: number; tins: number }

const SURFACE_MAP: Record<string, string> = { outside: "Outside", inside: "Inside", "外面": "Outside", "内面": "Inside" };
const PART_MAP: Record<string, string> = { lid: "Lid", body: "Body", bottom: "Bottom", lid_body: "Lid & Body", lid_body_bottom: "Lid, Body & Bottom", "蓋": "Lid", "身": "Body", "底": "Bottom" };

function fmtRmb(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `¥${n.toLocaleString()}`;
}

function fmtJpy(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseInt(v) : v;
  return isNaN(n) ? "—" : `¥${n.toLocaleString()}`;
}

function fmtRmbUnit(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `¥${n.toFixed(4)}`;
}

export interface CustomerQuoteSidebarData {
  // Factory sheet (non-price)
  moldNumber: string | null;
  productDimensions: string | null;
  steelThickness: number | null;
  moldImageUrl: string | null;
  printingLines: PrintingLine[] | null;
  packagingLines: PackagingLine[] | null;
  // Cost calc
  wilfredTiers: { tier_label: string; quantity: number; estimated_cost_rmb: number | null }[];
  moldCostNew: number | null;
  moldCostAdjust: number | null;
  embossingCost: number | null;
  moldLeadTimeDays: number | null;
  // DDP calc (selling price)
  ddpTiers: { tier_label: string; quantity: number; unit_price_jpy: number | null; total_revenue_jpy: number | null; selected_margin: number | null }[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{title}</p>
      {children}
    </div>
  );
}

export default function CustomerQuoteSidebar({ data }: { data: CustomerQuoteSidebarData }) {
  const {
    moldNumber, productDimensions, steelThickness, moldImageUrl,
    printingLines, packagingLines,
    wilfredTiers, moldCostNew, moldCostAdjust, embossingCost, moldLeadTimeDays,
    ddpTiers,
  } = data;

  return (
    <div className="space-y-4">
      {/* Factory Sheet header */}
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "oklch(0.88 0.04 230)" }}>
        <Factory className="h-4 w-4 shrink-0" style={{ color: "oklch(0.55 0.10 230)" }} />
        <div>
          <p className="text-sm font-semibold">{moldNumber ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground">Factory Sheet</p>
        </div>
      </div>

      {/* Mold image */}
      {moldImageUrl && (
        <div className="rounded-md border overflow-hidden bg-white">
          <img src={moldImageUrl} alt={`Mold ${moldNumber}`} className="w-full h-auto object-contain" style={{ maxHeight: "120px" }} />
        </div>
      )}

      {/* Mold info */}
      <Section title="Mold Info">
        <div className="text-xs space-y-0.5">
          {productDimensions && <div><span className="text-muted-foreground">Size: </span>{productDimensions}</div>}
          {steelThickness && <div><span className="text-muted-foreground">Thickness: </span>{steelThickness}mm</div>}
        </div>
      </Section>

      {/* Printing */}
      {printingLines && printingLines.length > 0 && (
        <Section title="Printing">
          <div className="text-xs space-y-0.5">
            {printingLines.map((ln, i) => (
              <div key={i}>
                <span className="text-muted-foreground">{SURFACE_MAP[ln.surface] ?? ln.surface}/{PART_MAP[ln.part] ?? ln.part}: </span>
                {ln.spec || "—"}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Packaging */}
      {packagingLines && packagingLines.length > 0 && (
        <Section title="Packaging">
          <div className="text-xs space-y-0.5">
            {packagingLines.map((p, i) => (
              <div key={i}>
                <span className="font-medium">{p.type}</span>
                {p.tins ? <span className="text-muted-foreground"> · {p.tins} tins</span> : null}
                {p.cbm ? <span className="text-muted-foreground"> · {p.cbm}m³</span> : null}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Cost Calc section */}
      <div className="flex items-center gap-2 pt-2 pb-1 border-t" style={{ borderColor: "oklch(0.88 0.06 300)" }}>
        <Calculator className="h-4 w-4 shrink-0" style={{ color: "oklch(0.55 0.12 300)" }} />
        <p className="text-sm font-semibold">Cost Calc</p>
      </div>

      <Section title="Approved Costs">
        <div className="text-xs space-y-0.5">
          {moldCostNew != null && <div><span className="text-muted-foreground">New Mold: </span><strong>{fmtRmb(moldCostNew)}</strong></div>}
          {moldCostAdjust != null && <div><span className="text-muted-foreground">Adjust: </span><strong>{fmtRmb(moldCostAdjust)}</strong></div>}
          {embossingCost != null && <div><span className="text-muted-foreground">Embossing: </span><strong>{fmtRmb(embossingCost)}</strong></div>}
          {moldLeadTimeDays != null && <div><span className="text-muted-foreground">Lead: </span><strong>{moldLeadTimeDays} days</strong></div>}
        </div>
      </Section>

      {wilfredTiers.length > 0 && (
        <Section title="Cost per Tier (RMB)">
          <div className="text-xs space-y-1">
            {wilfredTiers.map((t) => (
              <div key={t.tier_label} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                <span>{t.quantity?.toLocaleString()} pcs</span>
                <span className="font-mono font-semibold">{fmtRmbUnit(t.estimated_cost_rmb)}/pc</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* DDP Calc section */}
      <div className="flex items-center gap-2 pt-2 pb-1 border-t" style={{ borderColor: "oklch(0.88 0.06 145)" }}>
        <Truck className="h-4 w-4 shrink-0" style={{ color: "oklch(0.55 0.15 145)" }} />
        <p className="text-sm font-semibold">DDP Selling Price</p>
      </div>

      {ddpTiers.length > 0 && (
        <Section title="Price per Tier (JPY)">
          <div className="text-xs space-y-1">
            {ddpTiers.map((t) => (
              <div key={t.tier_label} className="rounded bg-muted/40 px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span>{t.quantity?.toLocaleString()} pcs</span>
                  <span className="font-mono font-semibold">{fmtJpy(t.unit_price_jpy)}/pc</span>
                </div>
                <div className="flex justify-between mt-0.5 text-[10px] text-muted-foreground">
                  <span>Revenue: {fmtJpy(t.total_revenue_jpy)}</span>
                  <span>Margin: {t.selected_margin != null ? `${(Number(t.selected_margin) * 100).toFixed(0)}%` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
