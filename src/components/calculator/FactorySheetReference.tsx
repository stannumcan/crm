"use client";

import { Factory, Paperclip } from "lucide-react";

interface PrintingLine { surface: string; part: string; spec: string }
interface EmbossingLine { component: string; cost_rmb: string; notes: string }
interface PackagingLine { type: string; config: string; l: number; w: number; h: number; cbm: number; tins: number }
interface TierCost { tier_label: string; quantity: number | null; container_info?: string | null; total_subtotal: number | null; labor_cost: number | null; accessories_cost: number | null }

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
  return isNaN(n) ? "—" : `¥${n.toFixed(2)}`;
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
  attachments: { name: string; url: string }[] | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{title}</p>
      {children}
    </div>
  );
}

export default function FactorySheetReference({ data }: { data: FactorySheetRefData }) {
  const {
    moldNumber, productDimensions, steelThickness, version,
    moldCostNew, moldCostModify, moldLeadTimeDays, moldImageUrl,
    printingLines, embossingLines, packagingLines, tierCosts, attachments,
  } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "oklch(0.88 0.04 230)" }}>
        <Factory className="h-4 w-4 shrink-0" style={{ color: "oklch(0.55 0.10 230)" }} />
        <div>
          <p className="text-sm font-semibold">Factory Sheet</p>
          <p className="text-[10px] text-muted-foreground font-mono">{moldNumber ?? "—"} · v{version}</p>
        </div>
      </div>

      {/* Mold image */}
      {moldImageUrl && (
        <div className="rounded-md border overflow-hidden bg-white">
          <img
            src={moldImageUrl}
            alt={`Mold ${moldNumber}`}
            className="w-full h-auto object-contain"
            style={{ maxHeight: "140px" }}
          />
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

      {/* Embossing */}
      {embossingLines && embossingLines.length > 0 && (
        <Section title="Embossing">
          <div className="text-xs space-y-0.5">
            {embossingLines.map((ln, i) => (
              <div key={i}>
                {ln.component || "Embossing"}
                {ln.cost_rmb && <span className="text-muted-foreground"> · ¥{ln.cost_rmb}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Mold Costs */}
      <Section title="Mold Costs">
        <div className="text-xs space-y-0.5">
          <div><span className="text-muted-foreground">New: </span><strong>{fmtRmb(moldCostNew)}</strong></div>
          <div><span className="text-muted-foreground">Adjust: </span><strong>{fmtRmb(moldCostModify)}</strong></div>
          {moldLeadTimeDays && <div><span className="text-muted-foreground">Lead: </span><strong>{moldLeadTimeDays} days</strong></div>}
        </div>
      </Section>

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

      {/* Tier Costs */}
      {tierCosts.length > 0 && (
        <Section title="Cost per Tier">
          <div className="text-xs space-y-1">
            {tierCosts.map((t) => (
              <div key={t.tier_label} className="rounded bg-muted/40 px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Tier {t.tier_label}</span>
                  <span className="text-muted-foreground">
                    {t.quantity != null ? `${t.quantity.toLocaleString()} pcs` : (t.container_info ?? "—")}
                  </span>
                </div>
                <div className="flex gap-3 mt-0.5 text-muted-foreground">
                  <span>Tot: <span className="text-foreground font-mono">{fmtRmbUnit(t.total_subtotal)}</span></span>
                  <span>Lab: <span className="text-foreground font-mono">{fmtRmbUnit(t.labor_cost)}</span></span>
                  <span>Acc: <span className="text-foreground font-mono">{fmtRmbUnit(t.accessories_cost)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <Section title="Attachments">
          <div className="text-xs space-y-1">
            {attachments.map((att, i) => (
              <button
                key={i}
                type="button"
                onClick={() => window.open(att.url, `attachment-${i}`, "width=900,height=700,scrollbars=yes,resizable=yes")}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted/60 transition-colors text-blue-700 hover:text-blue-900 w-full text-left"
              >
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate text-xs">{att.name}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
