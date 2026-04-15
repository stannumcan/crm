"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, FileText, Plus } from "lucide-react";
import DeleteButton from "@/components/quotes/DeleteButton";
import EmptyState from "@/components/ui/empty-state";

const STATUS_LABEL: Record<string, string> = {
  draft:           "Draft",
  pending_factory: "Factory",
  pending_wilfred: "Cost Calc",
  pending_natsuki: "DDP",
  sent:            "Sent",
  approved:        "Approved",
  rejected:        "Rejected",
};

function statusPillStyle(status: string): { bg: string; fg: string; border: string } {
  if (status === "rejected") return { bg: "oklch(0.97 0.02 20)", fg: "oklch(0.45 0.15 20)", border: "oklch(0.85 0.08 20)" };
  if (status === "approved") return { bg: "oklch(0.97 0.04 145)", fg: "oklch(0.40 0.15 145)", border: "oklch(0.85 0.08 145)" };
  if (status === "sent")     return { bg: "oklch(0.97 0.03 230)", fg: "oklch(0.40 0.15 230)", border: "oklch(0.85 0.08 230)" };
  return { bg: "oklch(0.96 0 0)", fg: "oklch(0.35 0 0)", border: "oklch(0.88 0 0)" };
}

// ── Per-tab step status (Waiting / Needs action / Complete) ──────────────────
const STATUS_ORDER = ["draft", "pending_factory", "pending_wilfred", "pending_natsuki", "sent", "approved"];

type StepStatus = "waiting" | "needs_action" | "complete" | "rejected";

function computeStepStatus(stepKey: string, quoteStatus: string): StepStatus {
  if (quoteStatus === "rejected") return "rejected";
  const stepIdx = STATUS_ORDER.indexOf(stepKey);
  const currentIdx = STATUS_ORDER.indexOf(quoteStatus);
  if (stepIdx < 0 || currentIdx < 0) return "waiting";
  if (currentIdx < stepIdx) return "waiting";
  if (currentIdx === stepIdx) return "needs_action";
  return "complete";
}

function stepStatusLabel(s: StepStatus): string {
  switch (s) {
    case "complete":     return "Complete";
    case "needs_action": return "Needs action";
    case "waiting":      return "Waiting for previous step";
    case "rejected":     return "Rejected";
  }
}

function stepStatusStyle(s: StepStatus): { bg: string; fg: string; border: string } {
  switch (s) {
    case "complete":     return { bg: "oklch(0.97 0.04 145)", fg: "oklch(0.40 0.15 145)", border: "oklch(0.85 0.08 145)" };
    case "needs_action": return { bg: "oklch(0.97 0.04 85)",  fg: "oklch(0.45 0.14 85)",  border: "oklch(0.85 0.10 85)"  };
    case "waiting":      return { bg: "oklch(0.96 0 0)",       fg: "oklch(0.50 0 0)",       border: "oklch(0.88 0 0)"       };
    case "rejected":     return { bg: "oklch(0.97 0.02 20)",   fg: "oklch(0.45 0.15 20)",   border: "oklch(0.85 0.08 20)"   };
  }
}

function daysAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
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
  updated_at: string | null;
  work_orders: {
    id: string | null;
    wo_number: string | null;
    company_id: string | null;
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
  rowHrefSuffix = "",
  stepKey,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  emptyActionHref,
}: {
  rows: QuoteRow[];
  locale: string;
  /** Appended to /quotes/{id} when a row is clicked. Default: overview. */
  rowHrefSuffix?: string;
  /** If provided, Progress column shows waiting/needs-action/complete
   *  relative to this workflow step key instead of the raw quote status. */
  stepKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filter chips differ by mode:
  //   - Without stepKey (Quote Requests tab): by raw status
  //   - With stepKey (step tabs): by step-relative status
  const chips = stepKey
    ? [
        { value: "all",          label: "All" },
        { value: "waiting",      label: "Waiting" },
        { value: "needs_action", label: "Needs action" },
        { value: "complete",     label: "Complete" },
      ]
    : FILTER_CHIPS;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all") {
        if (stepKey) {
          if (computeStepStatus(stepKey, r.status) !== statusFilter) return false;
        } else {
          if (r.status !== statusFilter) return false;
        }
      }
      if (!q) return true;
      const quoteRef = r.work_orders?.wo_number && r.quote_version
        ? `${r.work_orders.wo_number}-${String(r.quote_version).padStart(2, "0")}`
        : "";
      const haystack = [
        r.work_orders?.wo_number,
        quoteRef,
        r.work_orders?.company_name,
        r.work_orders?.project_name,
        r.status,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, statusFilter, stepKey]);

  // Count helper for the chip count badge
  const countFor = (chipValue: string): number => {
    if (chipValue === "all") return rows.length;
    if (stepKey) {
      return rows.filter((r) => computeStepStatus(stepKey, r.status) === chipValue).length;
    }
    return rows.filter((r) => r.status === chipValue).length;
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by WO, quote ref, company, project..."
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
          {chips.map((chip) => {
            const active = statusFilter === chip.value;
            const count = countFor(chip.value);
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
              <Th>Quote Request #</Th>
              <Th>Company</Th>
              <Th>Project</Th>
              <Th>Progress</Th>
              <Th>Created</Th>
              <Th>Last Action</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  {rows.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title={emptyTitle ?? "No quote requests yet"}
                      description={emptyDescription ?? "Create your first quote to kick off the workflow."}
                      actionLabel={emptyActionLabel ?? "New Quote Request"}
                      actionHref={emptyActionHref ?? `/${locale}/quotes/new`}
                      actionIcon={emptyActionLabel ? undefined : Plus}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground py-10 text-sm">No matches</div>
                  )}
                </td>
              </tr>
            )}
            {filtered.map((q) => {
              const wo = q.work_orders;
              const woRef = wo?.wo_number ?? "—";
              const version = q.quote_version ?? 1;
              const quoteRef = wo?.wo_number ? `${wo.wo_number}-${String(version).padStart(2, "0")}` : "—";

              // If this table is filtered to a specific workflow step, show the
              // row's status RELATIVE to that step (waiting / needs action /
              // complete). Otherwise show the raw quote status.
              const statusLabel = stepKey
                ? stepStatusLabel(computeStepStatus(stepKey, q.status))
                : (STATUS_LABEL[q.status] ?? q.status);
              const pill = stepKey
                ? stepStatusStyle(computeStepStatus(stepKey, q.status))
                : statusPillStyle(q.status);

              // Row-level click navigates to the quote overview (or a step page).
              // Inner links (WO #, Company) stopPropagation so they take precedence.
              return (
                <tr
                  key={q.id}
                  onClick={() => router.push(`/${locale}/quotes/${q.id}${rowHrefSuffix}`)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <Td>
                    {wo?.id ? (
                      <Link
                        href={`/${locale}/workorders/${wo.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono font-semibold text-blue-700 hover:underline"
                      >
                        {woRef}
                      </Link>
                    ) : (
                      <span className="font-mono font-semibold text-blue-700">{woRef}</span>
                    )}
                  </Td>
                  <Td>
                    <span className="font-mono font-semibold text-foreground">{quoteRef}</span>
                  </Td>
                  <Td className="font-medium">
                    {wo?.company_id ? (
                      <Link
                        href={`/${locale}/companies/${wo.company_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline hover:text-blue-700 transition-colors"
                      >
                        {wo.company_name ?? "—"}
                      </Link>
                    ) : (
                      wo?.company_name ?? "—"
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{wo?.project_name ?? "—"}</Td>
                  <Td>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
                      style={{ background: pill.bg, color: pill.fg, borderColor: pill.border }}
                    >
                      {statusLabel}
                    </span>
                  </Td>
                  <Td className="text-muted-foreground text-xs">
                    {q.created_at ? new Date(q.created_at).toLocaleDateString() : "—"}
                  </Td>
                  <Td className="text-muted-foreground text-xs">
                    <span title={q.updated_at ? new Date(q.updated_at).toLocaleString() : undefined}>
                      {daysAgo(q.updated_at)}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                      <DeleteButton endpoint={`/api/quotes/${q.id}`} label={`quote ${quoteRef}`} />
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
