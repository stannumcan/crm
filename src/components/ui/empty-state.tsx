import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

// Reusable empty-state block with an optional primary action.
// Use inside a table <td colSpan> or as a standalone placeholder.

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  actionIcon: ActionIcon,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  actionIcon?: React.ElementType;
}) {
  const content: ReactNode = (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-4">
          <Button size="sm" className="gap-1.5">
            {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
            {actionLabel}
          </Button>
        </Link>
      )}
    </div>
  );

  return content;
}
