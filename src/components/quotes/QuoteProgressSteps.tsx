"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Clock, ChevronRight } from "lucide-react";
import { usePermissions } from "@/lib/permissions-context";
import type { PageKey } from "@/lib/permissions";

type QuoteStatus =
  | "draft"
  | "pending_factory"
  | "pending_wilfred"
  | "pending_natsuki"
  | "sent"
  | "approved"
  | "rejected";

const STATUS_ORDER: QuoteStatus[] = [
  "pending_factory",
  "pending_wilfred",
  "pending_natsuki",
  "sent",
  "approved",
];

function getStepState(stepStatus: QuoteStatus, currentStatus: QuoteStatus): "done" | "current" | "upcoming" {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const stepIdx = STATUS_ORDER.indexOf(stepStatus);
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "current";
  return "upcoming";
}

export interface ProgressStep {
  status: QuoteStatus;
  label: string;
  sublabel: string;
  href: string;
  done: boolean;
  pageKey: PageKey;
}

export default function QuoteProgressSteps({
  steps,
  currentStatus,
}: {
  steps: ProgressStep[];
  currentStatus: QuoteStatus;
}) {
  const { canView, loading } = usePermissions();

  // While permissions are loading, hide the list to avoid a flash of forbidden steps.
  if (loading) {
    return <div className="space-y-3" aria-busy="true" />;
  }

  const visibleSteps = steps.filter((s) => canView(s.pageKey));

  if (visibleSteps.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        You don&apos;t have access to any steps of this quote workflow.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visibleSteps.map((step) => {
        const state = step.done ? "done" : getStepState(step.status, currentStatus);
        const isAccessible = step.done || state === "current";
        return (
          <div
            key={step.status}
            className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
              state === "current"
                ? "border-blue-200 bg-blue-50"
                : state === "done"
                ? "border-green-200 bg-green-50"
                : "border-gray-200 bg-gray-50 opacity-60"
            }`}
          >
            <div className="flex-shrink-0">
              {state === "done" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : state === "current" ? (
                <Clock className="h-5 w-5 text-blue-600" />
              ) : (
                <Circle className="h-5 w-5 text-gray-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  state === "done" ? "text-green-800" : state === "current" ? "text-blue-800" : "text-gray-500"
                }`}
              >
                {step.label}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{step.sublabel}</p>
            </div>
            {isAccessible && (
              <Link href={step.href}>
                <Button
                  size="sm"
                  variant={state === "current" ? "default" : "outline"}
                  className="gap-1 flex-shrink-0"
                >
                  {state === "done" ? "View" : "Start"}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
