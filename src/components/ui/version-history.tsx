"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { History, Clock, CheckCircle2, Pencil, Plus, ChevronDown, ChevronUp } from "lucide-react";

interface ChangeLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  version: number;
  action: string;
  changed_by: string | null;
  changed_at: string;
  snapshot: Record<string, unknown> | null;
}

interface VersionRow {
  id: string;
  version: number;
  is_current: boolean;
  superseded_at: string | null;
  created_at: string;
  created_by: string | null;
  [key: string]: unknown;
}

interface Props {
  entityType: string;
  /** For factory sheets, pass sheet_group_id. For others, pass cost_sheet_id or quotation_id */
  queryParams: Record<string, string>;
  /** Fields to show in the comparison table. Format functions are NOT supported (server/client boundary). Use formatHint instead. */
  displayFields: { key: string; label: string; formatHint?: "currency" | "percent" | "mm" }[];
  /** Fields that identify a tier row (for multi-row entities) */
  groupByField?: string;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  created: Plus,
  edited: Pencil,
  approved: CheckCircle2,
};

const ACTION_COLORS: Record<string, string> = {
  created: "text-blue-600",
  edited: "text-amber-600",
  approved: "text-green-600",
  superseded: "text-muted-foreground",
};

function formatValue(val: unknown, hint?: "currency" | "percent" | "mm"): string {
  if (val === null || val === undefined) return "—";
  if (hint === "currency") return `¥${Number(val).toLocaleString()}`;
  if (hint === "percent") return `${(Number(val) * 100).toFixed(0)}%`;
  if (hint === "mm") return `${val}mm`;
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export default function VersionHistory({ entityType, queryParams, displayFields, groupByField }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [changelog, setChangelog] = useState<ChangeLogEntry[]>([]);
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());

  const fetchHistory = async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: entityType, ...queryParams });
    const res = await fetch(`/api/workflow/history?${params}`);
    const data = await res.json();
    setVersions(data.versions ?? []);
    setChangelog(data.changelog ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchHistory();
  }, [open]);

  // Group versions by version number
  const versionGroups: Map<number, VersionRow[]> = new Map();
  for (const v of versions) {
    const group = versionGroups.get(v.version) ?? [];
    group.push(v);
    versionGroups.set(v.version, group);
  }
  const versionNumbers = Array.from(versionGroups.keys()).sort((a, b) => b - a);

  const toggleExpand = (v: number) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  // Get rows for a specific version
  const getVersionRows = (v: number) => versionGroups.get(v) ?? [];

  // Compare two versions
  const renderComparison = () => {
    if (!compareVersions) return null;
    const [v1, v2] = compareVersions;
    const rows1 = getVersionRows(v1);
    const rows2 = getVersionRows(v2);

    if (groupByField) {
      // Multi-row comparison (wilfred, ddp)
      const allGroups = new Set([
        ...rows1.map((r) => String(r[groupByField])),
        ...rows2.map((r) => String(r[groupByField])),
      ]);

      return (
        <div className="space-y-3 mt-4">
          <h4 className="text-sm font-semibold">Comparing v{v1} vs v{v2}</h4>
          {Array.from(allGroups).map((group) => {
            const r1 = rows1.find((r) => String(r[groupByField]) === group);
            const r2 = rows2.find((r) => String(r[groupByField]) === group);
            return (
              <div key={group} className="border rounded-md overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium">{groupByField}: {group}</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-3 py-1.5 text-muted-foreground font-medium w-1/3">Field</th>
                      <th className="text-left px-3 py-1.5 text-muted-foreground font-medium w-1/3">v{v1}</th>
                      <th className="text-left px-3 py-1.5 text-muted-foreground font-medium w-1/3">v{v2}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayFields.map((f) => {
                      const val1 = r1 ? formatValue(r1[f.key], f.formatHint) : "—";
                      const val2 = r2 ? formatValue(r2[f.key], f.formatHint) : "—";
                      const changed = val1 !== val2;
                      return (
                        <tr key={f.key} className={changed ? "bg-amber-50" : ""}>
                          <td className="px-3 py-1.5 text-muted-foreground">{f.label}</td>
                          <td className="px-3 py-1.5 font-mono">{val1}</td>
                          <td className={`px-3 py-1.5 font-mono ${changed ? "font-semibold text-amber-800" : ""}`}>{val2}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      );
    }

    // Single-row comparison (factory sheet, customer quote)
    const r1 = rows1[0];
    const r2 = rows2[0];
    return (
      <div className="mt-4">
        <h4 className="text-sm font-semibold mb-2">Comparing v{v1} vs v{v2}</h4>
        <table className="w-full text-xs border rounded-md overflow-hidden">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-1.5 text-muted-foreground font-medium w-1/3">Field</th>
              <th className="text-left px-3 py-1.5 text-muted-foreground font-medium w-1/3">v{v1}</th>
              <th className="text-left px-3 py-1.5 text-muted-foreground font-medium w-1/3">v{v2}</th>
            </tr>
          </thead>
          <tbody>
            {displayFields.map((f) => {
              const val1 = r1 ? formatValue(r1[f.key], f.formatHint) : "—";
              const val2 = r2 ? formatValue(r2[f.key], f.formatHint) : "—";
              const changed = val1 !== val2;
              return (
                <tr key={f.key} className={changed ? "bg-amber-50" : ""}>
                  <td className="px-3 py-1.5 text-muted-foreground">{f.label}</td>
                  <td className="px-3 py-1.5 font-mono">{val1}</td>
                  <td className={`px-3 py-1.5 font-mono ${changed ? "font-semibold text-amber-800" : ""}`}>{val2}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setOpen(true)}>
        <History className="h-3.5 w-3.5" /> History
      </Button>

      <Modal open={open} onClose={() => { setOpen(false); setCompareVersions(null); }} title="Version History">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : versionNumbers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No version history yet.</div>
        ) : (
          <div className="space-y-1 max-h-[60vh] overflow-auto">
            {/* Compare selector */}
            {versionNumbers.length >= 2 && (
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                <span>Compare:</span>
                <select
                  className="rounded border px-2 py-1 text-xs"
                  value={compareVersions?.[0] ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v && compareVersions) setCompareVersions([v, compareVersions[1]]);
                    else if (v) setCompareVersions([v, versionNumbers[1] ?? versionNumbers[0]]);
                  }}
                >
                  <option value="">v?</option>
                  {versionNumbers.map((v) => <option key={v} value={v}>v{v}</option>)}
                </select>
                <span>vs</span>
                <select
                  className="rounded border px-2 py-1 text-xs"
                  value={compareVersions?.[1] ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v && compareVersions) setCompareVersions([compareVersions[0], v]);
                    else if (v) setCompareVersions([versionNumbers[0], v]);
                  }}
                >
                  <option value="">v?</option>
                  {versionNumbers.map((v) => <option key={v} value={v}>v{v}</option>)}
                </select>
              </div>
            )}

            {renderComparison()}

            {/* Timeline */}
            <div className="relative pl-6 space-y-0 mt-4">
              {versionNumbers.map((vNum) => {
                const rows = getVersionRows(vNum);
                const row = rows[0];
                const isCurrent = row?.is_current;
                const logEntries = changelog.filter((c) => c.version === vNum);
                const expanded = expandedVersions.has(vNum);

                return (
                  <div key={vNum} className="relative pb-4">
                    {/* Timeline dot + line */}
                    <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 bg-background"
                      style={{ borderColor: isCurrent ? "oklch(0.55 0.18 145)" : "var(--border)" }}
                    />
                    {vNum !== versionNumbers[versionNumbers.length - 1] && (
                      <div className="absolute -left-[14px] top-4 w-px h-full bg-border" />
                    )}

                    {/* Version card */}
                    <div className={`rounded-md border px-3 py-2 ${isCurrent ? "border-green-200 bg-green-50/50" : "bg-muted/20"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${isCurrent ? "border-green-400 text-green-700" : ""}`}>
                            v{vNum}
                          </Badge>
                          {isCurrent && <span className="text-[10px] text-green-700 font-medium">Current</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {row?.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                          <button onClick={() => toggleExpand(vNum)} className="ml-1">
                            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Change log entries for this version */}
                      {logEntries.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {logEntries.map((entry) => {
                            const Icon = ACTION_ICONS[entry.action] ?? Pencil;
                            return (
                              <div key={entry.id} className="flex items-center gap-1.5 text-[10px]">
                                <Icon className={`h-3 w-3 ${ACTION_COLORS[entry.action] ?? ""}`} />
                                <span className="capitalize">{entry.action}</span>
                                {entry.changed_by && <span className="text-muted-foreground">by {entry.changed_by}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Expanded detail */}
                      {expanded && (
                        <div className="mt-2 border-t pt-2">
                          {rows.length === 1 ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                              {displayFields.map((f) => (
                                <div key={f.key}>
                                  <span className="text-muted-foreground">{f.label}: </span>
                                  <span className="font-mono">{formatValue(row[f.key], f.formatHint)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {rows.map((r, i) => (
                                <div key={r.id} className="text-[10px]">
                                  <span className="font-medium">{groupByField ? `${r[groupByField]}` : `Row ${i + 1}`}: </span>
                                  {displayFields.map((f) => (
                                    <span key={f.key} className="mr-3">
                                      <span className="text-muted-foreground">{f.label}: </span>
                                      <span className="font-mono">{formatValue(r[f.key], f.formatHint)}</span>
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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
