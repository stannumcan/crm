"use client";

import { Factory, Calculator } from "lucide-react";

interface PrintingLine { surface: string; part: string; spec: string }
interface EmbossingLine { component: string; cost_rmb: string; notes: string }
interface PackagingLine { type: string; config: string; l: number; w: number; h: number; cbm: number; tins: number }
interface WilfredTier { tier_label: string; quantity: number; total_subtotal: number | null; labor_cost: number | null; accessories_cost: number | null; overhead_multiplier: number | null; margin_rate: number | null; estimated_cost_rmb: number | null }

const SURFACE_MAP: Record<string, string> = { outside: "Outside", inside: "Inside", "外面": "Outside", "内面": "Inside" };
const PART_MAP: Record<string, string> = { lid: "Lid", body: "Body", bottom: "Bottom", lid_body: "Lid & Body", lid_body_bottom: "Lid, Body & Bottom", "蓋": "Lid", "身": "Body", "底": "Bottom" };

function fmtRmb(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `¥${n.toLocaleString()}`;
}

function fmtRmbUnit(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `¥${n.toFixed(4)}`;
}

export interface DDPSidebarData {
  // From factory sheet (non-price)
  moldNumber: string | null;
  productDimensions: string | null;
  steelThickness: number | null;
  sheetVersion: number;
  moldImageUrl: string | null;
  printingLines: PrintingLine[] | null;
  embossingLines: EmbossingLine[] | null;
  packagingLines: PackagingLine[] | null;
  attachments: { name: string; url: string }[] | null;
  // From factory sheet (mold costs — wilfred approved values)
  moldCostNew: number | null;
  moldCostModify: number | null;
  moldLeadTimeDays: number | null;
  embossingCost: number | null;
  // From wilfred calc (price data)
  wilfredVersion: number | null;
  wilfredTiers: WilfredTier[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{title}</p>
      {children}
    </div>
  );
}

export default function DDPSidebarReference({ data }: { data: DDPSidebarData }) {
  const {
    moldNumber, productDimensions, steelThickness, sheetVersion,
    moldImageUrl, printingLines, embossingLines, packagingLines, attachments,
    moldCostNew, moldCostModify, moldLeadTimeDays, embossingCost,
    wilfredVersion, wilfredTiers,
  } = data;

  return (
    <div className="space-y-4">
      {/* Factory Sheet header */}
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "oklch(0.88 0.04 230)" }}>
        <Factory className="h-4 w-4 shrink-0" style={{ color: "oklch(0.55 0.10 230)" }} />
        <div>
          <p className="text-sm font-semibold">{moldNumber ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground font-mono">Sheet v{sheetVersion}</p>
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

      {/* Divider — Wilfred calc section */}
      <div className="flex items-center gap-2 pt-2 pb-1 border-t" style={{ borderColor: "oklch(0.88 0.06 300)" }}>
        <Calculator className="h-4 w-4 shrink-0" style={{ color: "oklch(0.55 0.12 300)" }} />
        <div>
          <p className="text-sm font-semibold">Wilfred Calc</p>
          {wilfredVersion && <p className="text-[10px] text-muted-foreground font-mono">v{wilfredVersion}</p>}
        </div>
      </div>

      {/* Mold Costs (wilfred approved) */}
      <Section title="Approved Costs">
        <div className="text-xs space-y-0.5">
          <div><span className="text-muted-foreground">New Mold: </span><strong>{fmtRmb(moldCostNew)}</strong></div>
          <div><span className="text-muted-foreground">Adjust: </span><strong>{fmtRmb(moldCostModify)}</strong></div>
          {embossingCost && <div><span className="text-muted-foreground">Embossing: </span><strong>{fmtRmb(embossingCost)}</strong></div>}
          {moldLeadTimeDays && <div><span className="text-muted-foreground">Lead: </span><strong>{moldLeadTimeDays} days</strong></div>}
        </div>
      </Section>

      {/* Wilfred tier prices */}
      {wilfredTiers.length > 0 && (
        <Section title="Price per Tier">
          <div className="text-xs space-y-1">
            {wilfredTiers.map((t) => (
              <div key={t.tier_label} className="rounded bg-muted/40 px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Tier {t.tier_label}</span>
                  <span className="text-muted-foreground">{t.quantity?.toLocaleString()} pcs</span>
                </div>
                <div className="mt-0.5">
                  <span className="text-foreground font-mono font-semibold">{fmtRmbUnit(t.estimated_cost_rmb)}</span>
                  <span className="text-muted-foreground"> /pc</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

    </div>
  );
}
