"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Clock, Plus, Pencil, CheckCircle2 } from "lucide-react";

interface LogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  version: number;
  action: string;
  changed_by: string | null;
  changed_at: string;
  snapshot: Record<string, unknown> | null;
}

const ENTITY_LABELS: Record<string, string> = {
  factory_cost_sheet: "Factory Sheet",
  wilfred_calculation: "Cost Calc",
  natsuki_ddp_calculation: "DDP Calc",
  customer_quote: "Customer Quote",
};

const ENTITY_COLORS: Record<string, string> = {
  factory_cost_sheet: "oklch(0.60 0.18 50)",
  wilfred_calculation: "oklch(0.55 0.15 300)",
  natsuki_ddp_calculation: "oklch(0.55 0.15 230)",
  customer_quote: "oklch(0.55 0.18 145)",
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  created: Plus,
  edited: Pencil,
  approved: CheckCircle2,
};

export default function AuditTrail({ quotationId }: { quotationId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/workflow/audit?quotation_id=${quotationId}`)
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [open, quotationId]);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <ScrollText className="h-3.5 w-3.5" /> Audit Trail
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Audit Trail">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No audit entries yet.</div>
        ) : (
          <div className="max-h-[65vh] overflow-auto">
            <div className="relative pl-6 space-y-0">
              {entries.map((entry, idx) => {
                const Icon = ACTION_ICONS[entry.action] ?? Pencil;
                const color = ENTITY_COLORS[entry.entity_type] ?? "var(--border)";
                const label = ENTITY_LABELS[entry.entity_type] ?? entry.entity_type;
                const moldNumber = entry.snapshot?.mold_number as string | undefined;
                const isLast = idx === entries.length - 1;

                return (
                  <div key={entry.id} className="relative pb-3">
                    {/* Timeline dot + line */}
                    <div
                      className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full"
                      style={{ background: color }}
                    />
                    {!isLast && (
                      <div className="absolute -left-[17px] top-4 w-px h-full bg-border" />
                    )}

                    {/* Entry */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className="text-[10px] shrink-0"
                            style={{ borderColor: color + "60", color }}
                          >
                            {label}
                          </Badge>
                          <span className="text-xs font-medium capitalize">{entry.action}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">v{entry.version}</span>
                          {moldNumber && (
                            <span className="text-[10px] text-muted-foreground">{moldNumber}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(entry.changed_at).toLocaleString()}
                          {entry.changed_by && <span> · {entry.changed_by}</span>}
                        </div>
                      </div>
                      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
