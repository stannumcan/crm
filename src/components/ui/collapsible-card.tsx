"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Minimal collapsible card — used for the quote detail sidebar.
// Defaults to expanded; pass defaultOpen={false} to collapse initially.
export default function CollapsibleCard({
  title,
  defaultOpen = true,
  summary,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  /** Optional text shown next to the title when collapsed (e.g. a count). */
  summary?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {summary && <span className="text-xs text-muted-foreground font-normal">{summary}</span>}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
      </button>
      {open && <CardContent className="pt-0 pb-3 space-y-2">{children}</CardContent>}
    </Card>
  );
}
