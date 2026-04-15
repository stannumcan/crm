"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Search, X } from "lucide-react";
import DeleteButton from "@/components/quotes/DeleteButton";

const STATUS_STEPS = [
  { key: "draft",           label: "Draft" },
  { key: "pending_factory", label: "Factory" },
  { key: "pending_wilfred", label: "Cost Calc" },
  { key: "pending_natsuki", label: "DDP" },
  { key: "sent",            label: "Sent" },
  { key: "approved",        label: "Approved" },
];

function QuoteProgress({ status }: { status: string }) {
  if (status === "rejected") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-24 rounded-full bg-red-200 overflow-hidden">
          <div className="h-full w-full bg-red-500 rounded-full" />
        </div>
        <span className="text-xs text-red-600 font-medium">Rejected</span>
      </div>
    );
  }
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  const total = STATUS_STEPS.length - 1;
  const pct = currentIdx <= 0 ? 4 : Math.round((currentIdx / total) * 100);
  const label = STATUS_STEPS[currentIdx]?.label ?? status;
  const done = status === "approved";
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: done ? "oklch(0.60 0.15 145)" : "var(--primary)" }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}

const FILTER_CHIPS = [
  { value: "all",              label: "All" },
  { value: "pending_factory",  label: "Factory" },
  { value: "pending_wilfred",  label: "Cost Calc" },
  { value: "pending_natsuki",  label: "DDP" },
  { value: "sent",             label: "Sent" },
  { value: "approved",         label: "Approved" },
];

export interface QuoteRow {
  id: string;
  status: string;
  quote_version: number | null;
  created_at: string | null;
  work_orders: {
    wo_number: string | null;
    company_name: string | null;
    project_name: string | null;
  } | null;
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left text-xs font-medium text-muted-foreground px-3 py-2.5 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-sm ${className}`}>{children}</td>;
}

export default function QuoteRequestsTable({
  rows,
  locale,
  tVersion,
}: {
  rows: QuoteRow[];
  locale: string;
  tVersion: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        r.work_orders?.wo_number,
        r.work_orders?.company_name,
        r.work_orders?.project_name,
        r.status,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, statusFilter]);

  return (
    <div>
      {/* Filter bar */}
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
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTER_CHIPS.map((chip) => {
            const active = statusFilter === chip.value;
            const count = chip.value === "all" ? rows.length : rows.filter((r) => r.status === chip.value).length;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setStatusFilter(chip.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {chip.label} <span className="opacity-60 ml-0.5">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Result count */}
      {(search || statusFilter !== "all") && (
        <p className="text-xs text-muted-foreground mb-2">
          Showing {filtered.length} of {rows.length}
        </p>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <Th>WO #</Th>
              <Th>Company</Th>
              <Th>Project</Th>
              <Th>Version</Th>
              <Th>Progress</Th>
              <Th>Created</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-10">
                  {rows.length === 0 ? "No quote requests yet" : "No matches"}
                </td>
              </tr>
            )}
            {filtered.map((q) => {
              const wo = q.work_orders;
              return (
                <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                  <Td><span className="font-mono font-semibold text-blue-700">{wo?.wo_number ?? "—"}</span></Td>
                  <Td className="font-medium">{wo?.company_name ?? "—"}</Td>
                  <Td className="text-muted-foreground">{wo?.project_name ?? "—"}</Td>
                  <Td className="text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{tVersion} {q.quote_version ?? 1}</Badge>
                  </Td>
                  <Td><QuoteProgress status={q.status} /></Td>
                  <Td className="text-muted-foreground">{q.created_at ? new Date(q.created_at).toLocaleDateString() : "—"}</Td>
                  <Td>
                    <div className="flex items-center gap-0.5 justify-end">
                      <Link href={`/${locale}/quotes/${q.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      <DeleteButton endpoint={`/api/quotes/${q.id}`} label={`quote ${wo?.wo_number ?? q.id}`} />
                    </div>
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
