import type { LucideIcon } from "lucide-react";

import { SettingsProfileFieldGrid } from "@/components/dashboard/settings/settings-profile-field-card";
import { cn } from "@/lib/utils";

type SectionTone = "default" | "primary" | "success" | "info";

const TONE_STYLES: Record<
  SectionTone,
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
  info: {
    shell: "border-info/15 bg-card shadow-zynd-low",
    iconShell: "bg-info/10 text-info ring-info/20",
    divider: "border-info/10",
  },
};

type SettingsProfileSectionCardProps = {
  title: string;
  icon?: LucideIcon;
  tone?: SectionTone;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function SettingsProfileSectionCard({
  title,
  icon: Icon,
  tone = "default",
  badge,
  children,
  className,
}: SettingsProfileSectionCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border p-4 sm:p-5",
        styles.shell,
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center gap-3 border-b pb-4",
          styles.divider,
        )}
      >
        {Icon ? (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] ring-1 ring-inset",
              styles.iconShell,
            )}
          >
            <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <h3 className="text-body font-semibold text-foreground">{title}</h3>
          {badge}
        </div>
      </div>
      <SettingsProfileFieldGrid>{children}</SettingsProfileFieldGrid>
    </section>
  );
}
