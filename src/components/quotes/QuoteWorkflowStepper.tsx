"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Circle, Clock, FileText, Factory, Calculator, Truck, FileSignature } from "lucide-react";
import { usePermissions } from "@/lib/permissions-context";
import type { PageKey } from "@/lib/permissions";

type StepState = "done" | "current" | "upcoming";

interface Step {
  key: string;
  label: string;
  suffix: string;
  pageKey: PageKey;
  icon: React.ElementType;
  // Status that this step is "current" on. Used to derive state from quote.status.
  currentStatus: string;
}

const STEPS: Step[] = [
  { key: "request",        label: "Quote Request",  suffix: "/request",        pageKey: "quotes_requests",       icon: FileText,       currentStatus: "draft" },
  { key: "factory_sheet",  label: "Factory Sheet",  suffix: "/factory-sheet",  pageKey: "quotes_factory_sheet",  icon: Factory,        currentStatus: "pending_factory" },
  { key: "cost_calc",      label: "Cost Calc",      suffix: "/cost-calc",      pageKey: "quotes_wilfred_calc",   icon: Calculator,     currentStatus: "pending_wilfred" },
  { key: "ddp_calc",       label: "DDP Calc",       suffix: "/ddp-calc",       pageKey: "quotes_ddp_calc",       icon: Truck,          currentStatus: "pending_natsuki" },
  { key: "customer_quote", label: "Customer Quote", suffix: "/customer-quote", pageKey: "quotes_customer_quote", icon: FileSignature,  currentStatus: "sent" },
];

// Order of statuses used to compute which steps are done given a current quote.status
const STATUS_ORDER = ["draft", "pending_factory", "pending_wilfred", "pending_natsuki", "sent", "approved"];

function deriveState(step: Step, quoteStatus: string): StepState {
  const currentIdx = STATUS_ORDER.indexOf(quoteStatus);
  const stepIdx = STATUS_ORDER.indexOf(step.currentStatus);
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "current";
  return "upcoming";
}

export default function QuoteWorkflowStepper({
  basePath,
  quoteStatus,
}: {
  basePath: string;
  quoteStatus: string;
}) {
  const pathname = usePathname();
  const { canView, loading } = usePermissions();

  // Hide on the overview page — the big Progress cards there serve as the primary nav.
  const onOverview = pathname === basePath || pathname === basePath + "/";
  if (onOverview) return null;

  if (loading) return <div className="h-14 border-b border-border bg-card" />;

  const visible = STEPS.filter((s) => canView(s.pageKey));

  return (
    <div className="border-b border-border bg-card">
      <nav className="flex items-stretch overflow-x-auto px-2 md:px-4">
        {/* Back to overview */}
        <Link
          href={basePath}
          className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors border-r border-border/60 shrink-0"
          title="Back to quote overview"
        >
          <span>Overview</span>
        </Link>

        {visible.map((step, i) => {
          const href = basePath + step.suffix;
          const isActive = pathname.startsWith(href);
          const state = deriveState(step, quoteStatus);
          const Icon = step.icon;

          // Color scheme
          const color =
            state === "done" ? "oklch(0.55 0.18 145)" :      // green
            state === "current" ? "oklch(0.55 0.18 230)" :   // blue
            "oklch(0.70 0 0)";                                // gray

          const StateIcon = state === "done" ? CheckCircle2 : state === "current" ? Clock : Circle;

          return (
            <Link
              key={step.key}
              href={href}
              className={`
                group flex items-center gap-2 px-3 md:px-4 py-2.5 text-xs font-medium whitespace-nowrap shrink-0
                border-b-2 transition-colors
                ${isActive ? "border-b-primary text-primary" : "border-b-transparent hover:border-b-border"}
              `}
            >
              <span className="font-mono text-[10px] opacity-50">{String(i + 1).padStart(2, "0")}</span>
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: isActive ? undefined : color }} />
              <span className={isActive ? "" : "text-foreground/80"}>{step.label}</span>
              <StateIcon className="h-3 w-3 shrink-0" style={{ color }} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
