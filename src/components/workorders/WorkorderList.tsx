"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, X, ClipboardList, Plus } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";

export interface WorkorderRow {
  id: string;
  wo_number: string;
  company_name: string;
  company_id: string | null;
  project_name: string;
  status: string;
  mould_flow: string;
  quote_count: number;
  created_at: string;
  updated_at: string;
}

const STATUS_CHIPS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const FLOW_LABEL: Record<string, string> = {
  new: "New",
  existing: "Existing",
  modification: "Mod",
};

function statusStyle(s: string): { bg: string; fg: string; border: string } {
  if (s === "cancelled") return { bg: "oklch(0.97 0.02 20)", fg: "oklch(0.45 0.15 20)", border: "oklch(0.85 0.08 20)" };
  if (s === "completed") return { bg: "oklch(0.97 0.04 145)", fg: "oklch(0.40 0.15 145)", border: "oklch(0.85 0.08 145)" };
  return { bg: "oklch(0.97 0.03 230)", fg: "oklch(0.40 0.15 230)", border: "oklch(0.85 0.08 230)" };
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left text-xs font-medium text-muted-foreground px-3 py-2.5 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-sm ${className}`}>{children}</td>;
}

export default function WorkorderList({ rows, locale }: { rows: WorkorderRow[]; locale: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.wo_number, r.company_name, r.project_name]
        .join(" ").toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by WO, company, project..."
            className="pl-8 pr-8 h-8 text-sm"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((chip) => {
            const active = statusFilter === chip.value;
            const count = chip.value === "all" ? rows.length : rows.filter((r) => r.status === chip.value).length;
            return (
              <button key={chip.value} type="button" onClick={() => setStatusFilter(chip.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {chip.label} <span className="opacity-60 ml-0.5">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(search || statusFilter !== "all") && (
        <p className="text-xs text-muted-foreground mb-2">Showing {filtered.length} of {rows.length}</p>
      )}

      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <Th>WO #</Th>
              <Th>Company</Th>
              <Th>Project</Th>
              <Th>Mould</Th>
              <Th>Quotes</Th>
              <Th>Status</Th>
              <Th>Last Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  {rows.length === 0 ? (
                    <EmptyState
                      icon={ClipboardList}
                      title="No workorders yet"
                      description="Create your first workorder to get started."
                      actionLabel="New Workorder"
                      actionHref={`/${locale}/workorders/new`}
                      actionIcon={Plus}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground py-10 text-sm">No matches</div>
                  )}
                </td>
              </tr>
            )}
            {filtered.map((wo) => {
              const pill = statusStyle(wo.status);
              return (
                <tr
                  key={wo.id}
                  onClick={() => router.push(`/${locale}/workorders/${wo.id}`)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <Td>
                    <span className="font-mono font-semibold text-blue-700">{wo.wo_number}</span>
                  </Td>
                  <Td className="font-medium">
                    {wo.company_id ? (
                      <Link
                        href={`/${locale}/companies/${wo.company_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline hover:text-blue-700 transition-colors"
                      >
                        {wo.company_name}
                      </Link>
                    ) : wo.company_name}
                  </Td>
                  <Td className="text-muted-foreground">{wo.project_name}</Td>
                  <Td>
                    <Badge variant="outline" className="text-[10px]">
                      {FLOW_LABEL[wo.mould_flow] ?? wo.mould_flow}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">{wo.quote_count}</Td>
                  <Td>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
                      style={{ background: pill.bg, color: pill.fg, borderColor: pill.border }}
                    >
                      {wo.status.charAt(0).toUpperCase() + wo.status.slice(1)}
                    </span>
                  </Td>
                  <Td className="text-muted-foreground text-xs">
                    <span title={new Date(wo.updated_at).toLocaleString()}>
                      {daysAgo(wo.updated_at)}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
