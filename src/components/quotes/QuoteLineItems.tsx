import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Printer, Shapes, StickyNote } from "lucide-react";

// A "line item" on a quote = a specific mould to be quoted, with its own
// spec overrides (printing, embossing, size, variant label, notes).
// Saved in quotations.molds as JSONB.
interface MoldLineItem {
  value?: string | null;
  type?: "existing" | "new";
  size?: string | null;
  thickness?: string | null;
  design_count?: number | null;
  variant_label?: string | null;
  notes?: string | null;
  printing_lines?: { surface: string; part: string; spec: string }[];
  embossing_lines?: { component: string; notes?: string }[];
}

// Human-friendly labels for storage keys — supports legacy EN/JA values too.
const SURFACE_LABELS: Record<string, string> = {
  outside: "Outside", inside: "Inside",
  "外面": "Outside", "内面": "Inside",
  Exterior: "Outside", Interior: "Inside",
};
const PART_LABELS: Record<string, string> = {
  lid: "Lid", body: "Body", bottom: "Bottom",
  lid_body: "Lid & Body", lid_body_bottom: "Lid, Body & Bottom",
  "蓋": "Lid", "身": "Body", "底": "Bottom",
};

function formatPrintingLine(ln: { surface: string; part: string; spec: string }): string {
  const surface = SURFACE_LABELS[ln.surface] ?? ln.surface;
  const part = PART_LABELS[ln.part] ?? ln.part;
  const label = [surface, part].filter(Boolean).join(" / ");
  return label ? `${label}: ${ln.spec}` : ln.spec;
}

export interface QuoteLineItemsProps {
  molds: MoldLineItem[] | null | undefined;
  // Legacy quote-level fallbacks, only used if molds[] is empty
  legacy?: {
    mold_number?: string | null;
    size_dimensions?: string | null;
    printing_lid?: string | null;
    printing_body?: string | null;
    printing_bottom?: string | null;
    printing_inner?: string | null;
    embossment?: boolean | null;
    embossment_components?: string | null;
    embossment_notes?: string | null;
  };
}

export default function QuoteLineItems({ molds, legacy }: QuoteLineItemsProps) {
  const lineItems = Array.isArray(molds) && molds.length > 0 ? molds : null;

  // No per-line mold structure — render a single legacy card if there's anything to show.
  if (!lineItems) {
    const hasAny = legacy && (
      legacy.mold_number || legacy.size_dimensions ||
      legacy.printing_lid || legacy.printing_body || legacy.printing_bottom || legacy.printing_inner ||
      legacy.embossment
    );
    if (!hasAny) return null;

    const printingLines = [
      legacy!.printing_lid   ? `Lid: ${legacy!.printing_lid}` : null,
      legacy!.printing_body  ? `Body: ${legacy!.printing_body}` : null,
      legacy!.printing_bottom ? `Bottom: ${legacy!.printing_bottom}` : null,
      legacy!.printing_inner ? `Inner: ${legacy!.printing_inner}` : null,
    ].filter(Boolean) as string[];

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            What&apos;s being quoted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {legacy!.mold_number && (
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-semibold">{legacy!.mold_number}</span>
              {legacy!.size_dimensions && <span className="text-xs text-muted-foreground">{legacy!.size_dimensions}</span>}
            </div>
          )}
          {printingLines.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Printing: </span>
              {printingLines.join(" · ")}
            </div>
          )}
          {legacy!.embossment && (
            <div className="text-xs">
              <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-700">Embossment</Badge>
              {legacy!.embossment_components && <span className="ml-2 text-muted-foreground">{legacy!.embossment_components}</span>}
              {legacy!.embossment_notes && <span className="ml-2 text-muted-foreground">· {legacy!.embossment_notes}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            What&apos;s being quoted
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            {lineItems.length} line item{lineItems.length > 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border/60">
          {lineItems.map((m, i) => {
            const printing = (m.printing_lines ?? []).filter((ln) => ln.spec);
            const embossing = (m.embossing_lines ?? []).filter((ln) => ln.component);
            return (
              <div key={i} className="py-3 first:pt-1 last:pb-1">
                {/* Line header */}
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="flex items-center justify-center h-5 w-5 rounded bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200">
                    {i + 1}
                  </span>
                  <span className="font-mono font-semibold text-sm">{m.value ?? "New mould"}</span>
                  {m.type === "new" && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-800">New mould</Badge>
                  )}
                  {m.variant_label && (
                    <Badge variant="secondary" className="text-[10px]">{m.variant_label}</Badge>
                  )}
                  {m.design_count && m.design_count > 1 && !m.variant_label && (
                    <Badge variant="secondary" className="text-[10px]">{m.design_count} designs</Badge>
                  )}
                </div>

                {/* Spec line: size + thickness */}
                {(m.size || m.thickness) && (
                  <div className="text-xs text-muted-foreground mb-1.5 ml-7">
                    {m.size && <span>{m.size}</span>}
                    {m.size && m.thickness && <span className="mx-1.5">·</span>}
                    {m.thickness && <span>{m.thickness}mm thick</span>}
                  </div>
                )}

                {/* Printing */}
                {printing.length > 0 && (
                  <div className="text-xs mb-1.5 ml-7 flex items-start gap-1.5">
                    <Printer className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-muted-foreground font-medium">Printing: </span>
                      <span className="text-foreground">{printing.map(formatPrintingLine).join("; ")}</span>
                    </div>
                  </div>
                )}

                {/* Embossing */}
                {embossing.length > 0 && (
                  <div className="text-xs mb-1.5 ml-7 flex items-start gap-1.5">
                    <Shapes className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-muted-foreground font-medium">Embossing: </span>
                      <span className="text-foreground">
                        {embossing.map((ln) => `${ln.component}${ln.notes ? ` (${ln.notes})` : ""}`).join(", ")}
                      </span>
                    </div>
                  </div>
                )}

                {/* Per-item notes */}
                {m.notes && (
                  <div className="text-xs ml-7 flex items-start gap-1.5">
                    <StickyNote className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-amber-700 italic">{m.notes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
