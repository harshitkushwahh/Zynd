import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ClientDetailEmptyStateProps = {
  message: string;
  icon?: LucideIcon;
  className?: string;
};

export function ClientDetailEmptyState({
  message,
  icon: Icon = Inbox,
  className,
}: ClientDetailEmptyStateProps) {
  return (
    <Card
      className={cn(
        "distributor-client-family-groups-empty-card border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="distributor-client-family-groups-empty-card__body">
        <span
          className="distributor-client-family-groups-empty-card__icon flex size-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
          aria-hidden
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <p className="distributor-client-family-groups-empty-card__message">{message}</p>
      </div>
    </Card>
  );
}

export function isClientDetailValueEmpty(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === "—" || trimmed === "-";
}
