// Placeholder shown when a Stannum Can quote reaches a stage whose
// pricing/output module differs from Winhoop's (DDP calc, customer
// quote). The Winhoop versions of those modules can't be reused — CA
// uses USD/CAD, different shipping logic, and different document
// formats. The CA-specific implementations will land in a follow-up.

import Link from "next/link";
import { Construction, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  /** Module name shown in the headline, e.g. "DDP Calculator" or "Customer Quote" */
  moduleName: string;
  /** Locale for the back link */
  locale: string;
  /** Quote id for the back link */
  quoteId: string;
  /** Optional context: WO number, company, etc. */
  woNumber?: string | null;
  companyName?: string | null;
}

export default function StannumPlaceholder({ moduleName, locale, quoteId, woNumber, companyName }: Props) {
  return (
    <div className="p-6 max-w-2xl space-y-4">
      <Link href={`/${locale}/quotes/${quoteId}`}>
        <Button variant="outline" size="sm" className="gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to quote
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Construction className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base">Stannum Can — {moduleName}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(woNumber || companyName) && (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
              {woNumber && <span className="font-mono mr-2">{woNumber}</span>}
              {companyName && <span>{companyName}</span>}
            </div>
          )}

          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold mb-1">Coming soon</p>
            <p>
              The {moduleName.toLowerCase()} module for Stannum Can is in design and will
              be built in a follow-up release. Stannum Can&apos;s pricing and output formats
              differ from Winhoop&apos;s (USD/CAD billing, different shipping logic, different
              quote document) so this stage cannot reuse the existing Winhoop tooling.
            </p>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p className="font-medium text-gray-800">In the meantime:</p>
            <ul className="list-disc ml-5 space-y-0.5">
              <li>The earlier pipeline stages (quote request, factory sheet, cost calc) work normally for Stannum Can.</li>
              <li>Continue handling DDP pricing and customer quotes outside the system for now.</li>
              <li>Talk to Wilfred when you&apos;re ready to spec the CA-specific module.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
