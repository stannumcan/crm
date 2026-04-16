"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  CheckCircle2, Circle, Clock, SkipForward, Loader2,
  FileText, Wrench, Factory, Truck, Receipt, Archive, FlaskConical,
} from "lucide-react";
import { MILESTONE_DEFS, GROUP_LABELS, type MilestoneStatus } from "@/lib/milestones";

interface MilestoneRow {
  id: string;
  milestone_key: string;
  sort_order: number;
  status: MilestoneStatus;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  details: Record<string, string | number | null>;
  attachments: { name: string; url: string }[];
}

const GROUP_ICONS: Record<string, React.ElementType> = {
  quoting: FileText,
  sampling: FlaskConical,
  tooling: Wrench,
  production: Factory,
  shipping: Truck,
  financial: Receipt,
  close: Archive,
};

function statusIcon(status: MilestoneStatus) {
  switch (status) {
    case "completed":      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "in_progress":    return <Clock className="h-4 w-4 text-blue-600" />;
    case "skipped":        return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    case "not_applicable": return <Circle className="h-4 w-4 text-muted-foreground/30" />;
    default:               return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusColor(status: MilestoneStatus) {
  switch (status) {
    case "completed":      return "border-green-200 bg-green-50/50";
    case "in_progress":    return "border-blue-200 bg-blue-50/50";
    case "skipped":        return "border-gray-200 bg-gray-50/30 opacity-60";
    case "not_applicable": return "hidden";
    default:               return "border-gray-200 bg-white";
  }
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

export default function WorkorderTimeline({ workorderId }: { workorderId: string }) {
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionDetails, setActionDetails] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchMilestones = useCallback(async () => {
    const res = await fetch(`/api/workorders/${workorderId}/milestones`);
    if (res.ok) {
      const data = await res.json();
      setMilestones(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, [workorderId]);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  const openAction = (key: string) => {
    setActionKey(key);
    setActionNotes("");
    setActionDetails({});
    setError("");
  };

  const markComplete = async () => {
    if (!actionKey) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/workorders/${workorderId}/milestones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestone_key: actionKey,
          status: "completed",
          notes: actionNotes.trim() || null,
          details: Object.fromEntries(
            Object.entries(actionDetails).filter(([, v]) => v?.trim()),
          ),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setActionKey(null);
      fetchMilestones();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const markSkipped = async (key: string) => {
    await fetch(`/api/workorders/${workorderId}/milestones`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestone_key: key, status: "skipped" }),
    });
    fetchMilestones();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const visible = milestones.filter((m) => m.status !== "not_applicable");
  const def = (key: string) => MILESTONE_DEFS.find((d) => d.key === key);
  const actionDef = actionKey ? def(actionKey) : null;

  // Group milestones
  const grouped: { group: string; label: string; icon: React.ElementType; items: MilestoneRow[] }[] = [];
  const seenGroups = new Set<string>();
  for (const m of visible) {
    const d = def(m.milestone_key);
    const g = d?.group ?? "close";
    if (!seenGroups.has(g)) {
      seenGroups.add(g);
      grouped.push({
        group: g,
        label: GROUP_LABELS[g] ?? g,
        icon: GROUP_ICONS[g] ?? Circle,
        items: [],
      });
    }
    grouped.find((gr) => gr.group === g)?.items.push(m);
  }

  return (
    <>
      <div className="space-y-4">
        {grouped.map((grp) => {
          const GrpIcon = grp.icon;
          const allDone = grp.items.every((m) => m.status === "completed" || m.status === "skipped");
          return (
            <div key={grp.group}>
              <div className="flex items-center gap-2 mb-2">
                <GrpIcon className={`h-3.5 w-3.5 ${allDone ? "text-green-600" : "text-muted-foreground"}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {grp.label}
                </span>
              </div>

              <div className="space-y-1.5 ml-5 border-l-2 border-border pl-4">
                {grp.items.map((m) => {
                  const d = def(m.milestone_key);
                  const isNext = m.status === "pending" &&
                    visible.findIndex((v) => v.status === "pending") === visible.indexOf(m);
                  return (
                    <div
                      key={m.id}
                      className={`flex items-start gap-3 rounded-md border px-3 py-2 transition-colors ${statusColor(m.status)} ${isNext ? "ring-1 ring-blue-300" : ""}`}
                    >
                      <div className="mt-0.5 shrink-0">{statusIcon(m.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${m.status === "completed" ? "text-green-800" : m.status === "skipped" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {d?.label ?? m.milestone_key}
                          </span>
                          {d?.auto && <Badge variant="outline" className="text-[9px] h-4">auto</Badge>}
                          {d?.conditional && m.status === "pending" && (
                            <Badge variant="outline" className="text-[9px] h-4 text-amber-700 border-amber-300">optional</Badge>
                          )}
                          {m.completed_at && (
                            <span className="text-[10px] text-muted-foreground">{daysAgo(m.completed_at)}</span>
                          )}
                        </div>
                        {/* Details */}
                        {m.status === "completed" && m.details && Object.keys(m.details).length > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {Object.entries(m.details).map(([k, v]) => {
                              if (!v) return null;
                              const fieldDef = d?.fields?.find((f) => f.key === k);
                              return (
                                <span key={k} className="text-[11px] text-muted-foreground">
                                  <span className="font-medium">{fieldDef?.label ?? k}:</span> {String(v)}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {m.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">{m.notes}</p>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="shrink-0 flex items-center gap-1">
                        {m.status === "pending" && (
                          <Button
                            variant={isNext ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => openAction(m.milestone_key)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </Button>
                        )}
                        {m.status === "pending" && d?.conditional && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => markSkipped(m.milestone_key)}
                            title="Skip this milestone (bundled in another PO, etc.)"
                          >
                            <SkipForward className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete milestone modal */}
      <Modal open={!!actionKey} onClose={() => setActionKey(null)} title={`Complete: ${actionDef?.label ?? ""}`}>
        <div className="space-y-4">
          {actionDef?.fields && actionDef.fields.length > 0 && (
            <div className="space-y-3">
              {actionDef.fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-sm">{f.label}</Label>
                  <Input
                    type={f.type === "date" ? "date" : f.type === "number" || f.type === "currency" ? "number" : "text"}
                    step={f.type === "currency" ? "0.01" : undefined}
                    placeholder={f.placeholder}
                    value={actionDetails[f.key] ?? ""}
                    onChange={(e) => setActionDetails((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-sm">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="Any additional context..."
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] resize-y"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setActionKey(null)}>Cancel</Button>
            <Button onClick={markComplete} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Mark Complete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
