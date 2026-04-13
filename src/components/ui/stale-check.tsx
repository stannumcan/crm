"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  /** The table to check upstream version from */
  upstreamTable: string;
  /** Filters to find the upstream row (e.g. { id: "xxx" } or { cost_sheet_id: "xxx" }) */
  upstreamFilters: Record<string, string>;
  /** The version this entity was based on */
  basedOnVersion: number | null | undefined;
  /** Human-readable name of the upstream entity */
  upstreamName: string;
}

export default function StaleCheck({ upstreamTable, upstreamFilters, basedOnVersion, upstreamName }: Props) {
  const [staleInfo, setStaleInfo] = useState<{ isStale: boolean; currentVersion: number } | null>(null);

  useEffect(() => {
    if (basedOnVersion == null) return;

    const params = new URLSearchParams({
      table: upstreamTable,
      based_on_version: String(basedOnVersion),
      ...upstreamFilters,
    });

    fetch(`/api/workflow/stale-check?${params}`)
      .then((r) => r.json())
      .then((data) => setStaleInfo(data))
      .catch(() => {});
  }, [upstreamTable, basedOnVersion]);

  if (!staleInfo?.isStale) return null;

  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Outdated data</p>
        <p className="text-xs mt-0.5">
          This was calculated based on {upstreamName} v{basedOnVersion}, but v{staleInfo.currentVersion} is now available.
          Recalculate to use the latest data.
        </p>
      </div>
    </div>
  );
}
