import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

// Compact context header shown on every workflow subpage.
// Lives below the QuoteWorkflowStepper so users always know which
// quote they're working on without having to check the URL.

export default function QuoteContextBar({
  locale,
  quoteId,
  woNumber,
  quoteVersion,
  companyName,
  projectName,
  status,
  urgency,
  pricingChanged,
  designCount,
  size,
}: {
  locale: string;
  quoteId: string;
  woNumber: string | null;
  quoteVersion: number | null;
  companyName: string | null;
  projectName: string | null;
  status: string | null;
  urgency: boolean;
  pricingChanged: boolean;
  designCount?: number | null;
  size?: string | null;
}) {
  // Quote request ref — JP260001-01 style — shared across every downstream
  // artefact (factory sheets, cost calc, DDP, customer quote).
  const quoteRef = woNumber && quoteVersion
    ? `${woNumber}-${String(quoteVersion).padStart(2, "0")}`
    : woNumber;

  return (
    <div className="px-4 md:px-6 py-2 border-b border-border bg-muted/20">
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
        {/* Quote ref — clickable link back to overview */}
        <Link
          href={`/${locale}/quotes/${quoteId}`}
          className="font-mono text-xs font-semibold text-blue-700 hover:underline shrink-0"
          title={quoteVersion && quoteVersion > 1 ? `Quote version ${quoteVersion}` : undefined}
        >
          {quoteRef ?? "—"}
        </Link>

        {/* Project + company */}
        <span className="text-xs text-foreground min-w-0 truncate">
          <strong>{projectName ?? "—"}</strong>
          <span className="text-muted-foreground"> · {companyName ?? "—"}</span>
        </span>

        {/* Separator spacer */}
        <span className="flex-1" />

        {/* Optional quick specs */}
        {size && (
          <span className="text-[11px] text-muted-foreground hidden md:inline">{size}</span>
        )}
        {designCount && designCount > 1 && (
          <span className="text-[11px] text-muted-foreground hidden md:inline">{designCount} designs</span>
        )}

        {/* Badges */}
        {pricingChanged && (
          <Badge variant="destructive" className="text-[10px] gap-1 h-5">
            <AlertTriangle className="h-3 w-3" />
            Pricing changed
          </Badge>
        )}
        {urgency && (
          <Badge variant="destructive" className="text-[10px] h-5">URGENT</Badge>
        )}
        {status && (
          <Badge variant="outline" className="text-[10px] h-5 font-mono">{status}</Badge>
        )}
      </div>
    </div>
  );
}
