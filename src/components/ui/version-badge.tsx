"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface VersionBadgeProps {
  version: number;
  isStale?: boolean;
}

export function VersionBadge({ version, isStale }: VersionBadgeProps) {
  if (isStale) {
    return (
      <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50 gap-1">
        <AlertTriangle className="h-3 w-3" />
        v{version}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground gap-0.5">
      v{version}
    </Badge>
  );
}

interface StaleWarningProps {
  entityName: string;
  basedOnVersion: number;
  currentVersion: number;
}

export function StaleWarning({ entityName, basedOnVersion, currentVersion }: StaleWarningProps) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Outdated data</p>
        <p className="text-xs mt-0.5">
          This was calculated based on {entityName} v{basedOnVersion}, but v{currentVersion} is now available.
          Recalculate to use the latest data.
        </p>
      </div>
    </div>
  );
}
