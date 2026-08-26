import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SettingsPanelHeaderProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "default" | "destructive";
  actions?: React.ReactNode;
  descriptionSingleLine?: boolean;
};

export function SettingsPanelHeader({
  icon: Icon,
  title,
  description,
  tone = "default",
  actions,
  descriptionSingleLine = false,
}: SettingsPanelHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-2.5 pr-2">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
            tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted/60 text-muted-foreground",
          )}
        >
          <Icon className="size-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-compact font-semibold text-foreground">{title}</h2>
          {description ? (
            <p
              className={cn(
                "mt-1 text-caption leading-snug text-muted-foreground",
                descriptionSingleLine && "sm:whitespace-nowrap",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:self-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
