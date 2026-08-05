import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SecurityFeatureTone = "default" | "primary" | "success" | "muted";

const TONE_STYLES: Record<
  SecurityFeatureTone,
  { shell: string; iconShell: string; divider: string }
> = {
  default: {
    shell: "border-border/70 bg-card shadow-zynd-low",
    iconShell: "bg-muted text-muted-foreground ring-border/60",
    divider: "border-border/50",
  },
  primary: {
    shell: "border-primary/15 bg-card shadow-zynd-low",
    iconShell: "bg-primary/10 text-primary ring-primary/20",
    divider: "border-primary/10",
  },
  success: {
    shell: "border-success/15 bg-card shadow-zynd-low",
    iconShell: "bg-success/10 text-success ring-success/20",
    divider: "border-success/10",
  },
  muted: {
    shell: "border-border/70 bg-card shadow-zynd-low",
    iconShell: "bg-muted text-muted-foreground ring-border/60",
    divider: "border-border/50",
  },
};

type SecurityFeatureCardProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: SecurityFeatureTone;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function SecurityFeatureCard({
  title,
  description,
  icon: Icon,
  tone = "default",
  badge,
  actions,
  children,
  className,
}: SecurityFeatureCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border p-4 sm:p-5",
        styles.shell,
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] ring-1 ring-inset",
              styles.iconShell,
            )}
          >
            <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-body font-semibold text-foreground">{title}</h3>
              {badge}
            </div>
            {description ? (
              <p className="text-caption leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        ) : null}
      </div>

      {children ? (
        <div className={cn("mt-5 border-t pt-5", styles.divider)}>{children}</div>
      ) : null}
    </section>
  );
}
