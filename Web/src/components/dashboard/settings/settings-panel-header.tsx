import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SettingsPanelHeaderProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "default" | "destructive";
  actions?: React.ReactNode;
};

export function SettingsPanelHeader({
  icon: Icon,
  title,
  description,
  tone = "default",
  actions,
}: SettingsPanelHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-card)]",
            tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-h4 font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-2 text-body text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
