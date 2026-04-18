import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  none: { label: "None", variant: "outline" },
  pending: { label: "Pending", variant: "secondary" },
  enriched: { label: "Enriched", variant: "default" },
  skipped: { label: "Skipped", variant: "destructive" },
};

export function EnrichmentStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.none;
  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}
