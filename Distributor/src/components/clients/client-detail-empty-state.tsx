import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

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
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 px-4 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-muted/60">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="max-w-sm text-caption leading-snug text-muted-foreground">{message}</p>
    </div>
  );
}

export function isClientDetailValueEmpty(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === "—" || trimmed === "-";
}
