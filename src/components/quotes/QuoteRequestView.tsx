"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Pencil, X, Check, Paperclip, AlertCircle, CheckCircle2, Ban, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

const SURFACE_KEYS = ["outside", "inside"] as const;
const PART_KEYS = ["lid", "body", "bottom", "lid_body", "lid_body_bottom"] as const;
const SURFACE_LABELS: Record<string, string> = { outside: "Outside", inside: "Inside" };
const PART_LABELS: Record<string, string> = { lid: "Lid", body: "Body", bottom: "Bottom", lid_body: "Lid & Body", lid_body_bottom: "Lid, Body & Bottom" };
const PART_TO_KEY: Record<string, string> = {};
for (const [k, v] of Object.entries(PART_LABELS)) { PART_TO_KEY[k] = k; PART_TO_KEY[v] = k; }

interface MoldEntry {
  id?: string;
  type: "existing" | "new";
  value: string;
  size: string;
  thickness: string;
  design_count: string | number;
}

interface QuantityTier {
  id: string;
  tier_label: string;
  quantity_type: "units" | "fcl_20ft" | "fcl_40ft";
  quantity: number | null;
  tier_notes: string | null;
  sort_order: number;
}

interface Quote {
  id: string;
  quote_version: number;
  status: string;
  urgency: boolean;
  shipping_info_required: boolean;
  deadline: string | null;
  molds: MoldEntry[] | null;
  mold_number: string | null;
  size_dimensions: string | null;
  printing_lid: string | null;
  printing_body: string | null;
  printing_bottom: string | null;
  printing_inner: string | null;
  printing_notes: string | null;
  embossment: boolean;
  embossment_notes: string | null;
  design_count: number | null;
  internal_notes: string | null;
  attachments: { name: string; url: string; size: number; type: string }[] | null;
  created_at: string;
  created_by: string | null;
  work_orders: { id: string; wo_number: string; company_name: string; project_name: string } | null;
  quotation_quantity_tiers: QuantityTier[];
}

// ── Editable field ─────────────────────────────────────────────────────────────
function Field({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children ?? <p className="text-sm mt-0.5">{value ?? <span className="text-muted-foreground italic">—</span>}</p>}
    </div>
  );
}

export default function QuoteRequestView({
  quote,
  quoteId,
  locale,
}: {
  quote: Quote;
  quoteId: string;
  locale: string;
}) {
  const wo = quote.work_orders;
  const tiers = [...(quote.quotation_quantity_tiers ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const molds: MoldEntry[] = quote.molds ?? (quote.mold_number ? [{ type: "existing", value: quote.mold_number, size: quote.size_dimensions ?? "", thickness: "", design_count: quote.design_count ?? 1 }] : []);

  // ── Edit state ────────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Editable fields
  const [urgency, setUrgency] = useState(quote.urgency);
  const [shippingInfoRequired, setShippingInfoRequired] = useState(quote.shipping_info_required);
  const [deadline, setDeadline] = useState(quote.deadline ? quote.deadline.split("T")[0] : "");
  const [printingLid, setPrintingLid] = useState(quote.printing_lid ?? "");
  const [printingBody, setPrintingBody] = useState(quote.printing_body ?? "");
  const [printingBottom, setPrintingBottom] = useState(quote.printing_bottom ?? "");
  const [printingInner, setPrintingInner] = useState(quote.printing_inner ?? "");
  const [printingNotes, setPrintingNotes] = useState(quote.printing_notes ?? "");
  const [embossment, setEmbossment] = useState(quote.embossment);
  const [embossmentNotes, setEmbossmentNotes] = useState(quote.embossment_notes ?? "");
  const [internalNotes, setInternalNotes] = useState(quote.internal_notes ?? "");

  const router = useRouter();
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [newMoldNumber, setNewMoldNumber] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newThickness, setNewThickness] = useState("");
  const [newVariant, setNewVariant] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newPrintingLines, setNewPrintingLines] = useState<{ surface: string; part: string; spec: string }[]>([{ surface: "outside", part: "", spec: "" }]);
  const [newEmbossingLines, setNewEmbossingLines] = useState<{ component: string; notes: string }[]>([]);
  const [addingLine, setAddingLine] = useState(false);

  const handleCancelLine = async (idx: number) => {
    if (!confirm(`Cancel line item ${idx + 1} (${molds[idx]?.value})? This will cancel the factory sheet and all downstream steps.`)) return;
    setCancelling(idx);
    try {
      await fetch(`/api/quotes/${quoteId}/cancel-line`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_index: idx }),
      });
      router.refresh();
    } finally {
      setCancelling(null);
    }
  };

  const handleAddLine = async () => {
    if (!newMoldNumber.trim()) return;
    setAddingLine(true);
    try {
      await fetch(`/api/quotes/${quoteId}/add-line`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_item: {
            type: "existing",
            value: newMoldNumber.trim(),
            size: newSize.trim() || null,
            thickness: newThickness.trim() || null,
            design_count: 1,
            variant_label: newVariant.trim() || null,
            notes: newNotes.trim() || null,
            printing_lines: newPrintingLines.filter((ln) => ln.spec || ln.part),
            embossing_lines: newEmbossingLines.filter((ln) => ln.component),
          },
        }),
      });
      setAddLineOpen(false);
      setNewMoldNumber(""); setNewSize(""); setNewThickness(""); setNewVariant(""); setNewNotes("");
      setNewPrintingLines([{ surface: "outside", part: "", spec: "" }]); setNewEmbossingLines([]);
      router.refresh();
    } finally {
      setAddingLine(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urgency,
          shipping_info_required: shippingInfoRequired,
          deadline: deadline || null,
          printing_lid: printingLid || null,
          printing_body: printingBody || null,
          printing_bottom: printingBottom || null,
          printing_inner: printingInner || null,
          printing_notes: printingNotes || null,
          embossment,
          embossment_notes: embossmentNotes || null,
          internal_notes: internalNotes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setUrgency(quote.urgency);
    setShippingInfoRequired(quote.shipping_info_required);
    setDeadline(quote.deadline ? quote.deadline.split("T")[0] : "");
    setPrintingLid(quote.printing_lid ?? "");
    setPrintingBody(quote.printing_body ?? "");
    setPrintingBottom(quote.printing_bottom ?? "");
    setPrintingInner(quote.printing_inner ?? "");
    setPrintingNotes(quote.printing_notes ?? "");
    setEmbossment(quote.embossment);
    setEmbossmentNotes(quote.embossment_notes ?? "");
    setInternalNotes(quote.internal_notes ?? "");
    setErr("");
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Quote Request</h1>
          {wo && (
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-mono font-medium text-foreground">{wo.wo_number}</span>
              {" · "}{wo.company_name}{" · "}{wo.project_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">Version {quote.quote_version}</Badge>
          {!editing ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCancel} disabled={saving}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                <Check className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      {err && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{err}</div>}

      {/* Flags */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request Flags</h2>
        {editing ? (
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={urgency} onChange={e => setUrgency(e.target.checked)} className="rounded" />
              Urgent
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={shippingInfoRequired} onChange={e => setShippingInfoRequired(e.target.checked)} className="rounded" />
              Shipping info required
            </label>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {urgency ? (
              <Badge variant="destructive">URGENT</Badge>
            ) : (
              <span className="text-xs text-muted-foreground italic">Not urgent</span>
            )}
            {shippingInfoRequired && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700">
                <AlertCircle className="h-3.5 w-3.5" /> Shipping info required
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deadline */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deadline</h2>
        {editing ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Deadline</Label>
            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="max-w-xs" />
          </div>
        ) : (
          <Field
            label="Deadline"
            value={quote.deadline ? new Date(quote.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null}
          />
        )}
      </div>

      {/* Line Items */}
      {molds.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Line Items</h2>
          {molds.map((mold, i) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = mold as any;
            const printingLines = (m.printing_lines ?? []) as { surface: string; part: string; spec: string }[];
            const embossingLines = (m.embossing_lines ?? []) as { component: string; notes?: string }[];
            const isCancelled = !!m.cancelled;
            return (
              <div key={i} className={`bg-card border rounded-lg p-4 space-y-3 ${isCancelled ? "border-red-200 opacity-50" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs">{i + 1}</Badge>
                    <span className={`font-mono font-semibold text-sm ${isCancelled ? "line-through" : ""}`}>{mold.value || "—"}</span>
                    {m.variant_label && <Badge variant="secondary" className="text-[10px]">{m.variant_label}</Badge>}
                    {isCancelled && <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>}
                  </div>
                  {!isCancelled && !editing && (
                    <Button
                      type="button" variant="ghost" size="sm"
                      className="h-7 text-xs gap-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleCancelLine(i)}
                      disabled={cancelling === i}
                    >
                      <Ban className="h-3 w-3" />
                      {cancelling === i ? "Cancelling..." : "Cancel"}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <Field label="Size" value={mold.size || "—"} />
                  <Field label="Tin Thickness" value={mold.thickness ? `${mold.thickness}mm` : "—"} />
                  <Field label="Designs" value={String(mold.design_count || 1)} />
                  <Field label="Type" value={mold.type} />
                </div>
                {printingLines.length > 0 && printingLines.some((ln) => ln.spec) && (
                  <div>
                    <span className="text-xs text-muted-foreground">Printing</span>
                    <div className="mt-0.5 space-y-0.5">
                      {printingLines.filter((ln) => ln.spec).map((ln, j) => (
                        <p key={j} className="text-sm">
                          <span className="text-muted-foreground">{ln.surface}/{ln.part}: </span>
                          {ln.spec}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {embossingLines.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Embossing</span>
                    <div className="mt-0.5 space-y-0.5">
                      {embossingLines.map((ln, j) => (
                        <p key={j} className="text-sm">
                          {ln.component}{ln.notes ? ` — ${ln.notes}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {m.notes && (
                  <p className="text-sm text-amber-700">{m.notes}</p>
                )}
              </div>
            );
          })}

          {/* Add Line Item button */}
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs"
            onClick={() => setAddLineOpen(true)}>
            <Plus className="h-3 w-3" /> Add Line Item
          </Button>
        </div>
      )}

      {/* Quantity Tiers */}
      {tiers.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantity Tiers</h2>
          <div className="space-y-2">
            {tiers.map(tier => (
              <div key={tier.id} className="flex items-baseline gap-4 text-sm">
                <span className="flex items-center justify-center h-6 w-6 rounded bg-muted text-xs font-bold font-mono flex-shrink-0">
                  {tier.tier_label}
                </span>
                <span className="font-medium">
                  {tier.quantity_type === "units"
                    ? `${tier.quantity?.toLocaleString() ?? "—"} pcs`
                    : tier.quantity_type === "fcl_20ft" ? "20ft FCL" : "40ft FCL"}
                </span>
                {tier.tier_notes && <span className="text-muted-foreground text-xs">{tier.tier_notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Printing (for old quotes without per-item specs) */}
      {(quote.printing_lid || quote.printing_body || quote.printing_bottom || quote.printing_inner || quote.embossment) &&
       !(molds.length > 0 && molds.some((m: any) => Array.isArray((m as any).printing_lines) && (m as any).printing_lines.length > 0)) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Printing (Legacy)</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4">
              <Field label="Lid" value={quote.printing_lid} />
              <Field label="Body" value={quote.printing_body} />
              <Field label="Bottom" value={quote.printing_bottom} />
              <Field label="Inner" value={quote.printing_inner} />
            </div>
            {quote.printing_notes && <Field label="Notes" value={quote.printing_notes} />}
            {quote.embossment && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
                Embossment{quote.embossment_notes ? `: ${quote.embossment_notes}` : ""}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Internal Notes */}
      <div className="bg-card border border-amber-200 rounded-lg p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-600">Internal Notes</h2>
        {editing ? (
          <textarea
            value={internalNotes}
            onChange={e => setInternalNotes(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
            placeholder="Internal notes visible only to the team"
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">
            {quote.internal_notes ?? <span className="text-muted-foreground italic">No notes</span>}
          </p>
        )}
      </div>

      {/* Attachments */}
      {Array.isArray(quote.attachments) && quote.attachments.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> Attachments
          </h2>
          <ul className="space-y-2">
            {quote.attachments.map((f, i) => (
              <li key={i}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-700 hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span>{f.name}</span>
                  {f.size && <span className="text-xs text-muted-foreground">({(f.size / 1024).toFixed(0)} KB)</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Meta */}
      <p className="text-xs text-muted-foreground">
        Created {new Date(quote.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        {quote.created_by && ` by ${quote.created_by}`}
      </p>

      {/* Add Line Item Modal */}
      <Modal open={addLineOpen} onClose={() => setAddLineOpen(false)} title="Add Line Item">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mold Number <span className="text-red-500">*</span></Label>
            <Input value={newMoldNumber} onChange={(e) => setNewMoldNumber(e.target.value)} placeholder="ML-1004B" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Size / Dimensions</Label>
              <Input value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="200×200×40mm" />
            </div>
            <div className="space-y-1.5">
              <Label>Thickness (mm)</Label>
              <Input value={newThickness} onChange={(e) => setNewThickness(e.target.value)} placeholder="0.25" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Variant Label</Label>
            <Input value={newVariant} onChange={(e) => setNewVariant(e.target.value)} placeholder="e.g. Gloss, Matte" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Notes for this line item" />
          </div>

          {/* Printing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Printing</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] gap-1"
                onClick={() => setNewPrintingLines((prev) => [...prev, { surface: "outside", part: "", spec: "" }])}>
                <Plus className="h-2.5 w-2.5" /> Add
              </Button>
            </div>
            {newPrintingLines.map((ln, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="flex h-7 rounded-md border border-input bg-background px-2 text-xs w-24 shrink-0"
                  value={ln.surface} onChange={(e) => setNewPrintingLines((prev) => prev.map((l, j) => j === i ? { ...l, surface: e.target.value } : l))}>
                  {SURFACE_KEYS.map((k) => <option key={k} value={k}>{SURFACE_LABELS[k]}</option>)}
                </select>
                {PART_TO_KEY[ln.part] !== undefined || ln.part === "" ? (
                  <select className="flex h-7 rounded-md border border-input bg-background px-2 text-xs w-32 shrink-0"
                    value={ln.part} onChange={(e) => setNewPrintingLines((prev) => prev.map((l, j) => j === i ? { ...l, part: e.target.value === "__custom__" ? "" : e.target.value } : l))}>
                    <option value="">— Select —</option>
                    {PART_KEYS.map((k) => <option key={k} value={k}>{PART_LABELS[k]}</option>)}
                    <option value="__custom__">+ Custom...</option>
                  </select>
                ) : (
                  <Input className="h-7 text-xs w-32 shrink-0" value={ln.part} placeholder="Custom part"
                    onChange={(e) => setNewPrintingLines((prev) => prev.map((l, j) => j === i ? { ...l, part: e.target.value } : l))}
                    onBlur={(e) => { if (!e.target.value.trim()) setNewPrintingLines((prev) => prev.map((l, j) => j === i ? { ...l, part: "" } : l)); }} />
                )}
                <Input className="flex-1 h-7 text-xs" placeholder="Spec e.g. 4C+1PMS Coat Gloss"
                  value={ln.spec} onChange={(e) => setNewPrintingLines((prev) => prev.map((l, j) => j === i ? { ...l, spec: e.target.value } : l))} />
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0"
                  onClick={() => setNewPrintingLines((prev) => prev.filter((_, j) => j !== i))} disabled={newPrintingLines.length <= 1}>
                  <Trash2 className="h-3 w-3 text-gray-400" />
                </Button>
              </div>
            ))}
          </div>

          {/* Embossing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Embossing</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] gap-1"
                onClick={() => setNewEmbossingLines((prev) => [...prev, { component: "", notes: "" }])}>
                <Plus className="h-2.5 w-2.5" /> Add
              </Button>
            </div>
            {newEmbossingLines.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No embossing</p>
            ) : newEmbossingLines.map((ln, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input className="flex-1 h-7 text-xs" placeholder="Component e.g. Lid top"
                  value={ln.component} onChange={(e) => setNewEmbossingLines((prev) => prev.map((l, j) => j === i ? { ...l, component: e.target.value } : l))} />
                <Input className="flex-1 h-7 text-xs" placeholder="Notes"
                  value={ln.notes} onChange={(e) => setNewEmbossingLines((prev) => prev.map((l, j) => j === i ? { ...l, notes: e.target.value } : l))} />
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0"
                  onClick={() => setNewEmbossingLines((prev) => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3 w-3 text-gray-400" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setAddLineOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLine} disabled={addingLine || !newMoldNumber.trim()}>
              {addingLine ? "Adding..." : "Add & Create Factory Sheet"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
