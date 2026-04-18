import { Badge } from "@/components/ui/badge";

export function LeadScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;

  let variant: "default" | "destructive" | "outline" | "secondary" = "outline";
  if (score >= 70) variant = "default";
  else if (score >= 40) variant = "secondary";
  else variant = "destructive";

  return (
    <Badge variant={variant} className="text-xs tabular-nums">
      {score}
    </Badge>
  );
}
