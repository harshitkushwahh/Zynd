import type { LucideIcon } from "lucide-react";

import { SettingsProfileFieldGrid } from "@/components/dashboard/settings/settings-profile-field-card";
import { cn } from "@/lib/utils";

type SectionTone = "default" | "primary" | "success" | "info";

const TONE_STYLES: Record<
  SectionTone,
  { shell: string; divider: string }
> = {
  default: {
    shell: "border-border/70 bg-card shadow-zynd-low",
    divider: "border-border/50",
  },
  primary: {
    shell: "border-border/70 bg-card shadow-zynd-low",
    divider: "border-border/50",
  },
  success: {
    shell: "border-border/70 bg-card shadow-zynd-low",
    divider: "border-border/50",
  },
  info: {
    shell: "border-border/70 bg-card shadow-zynd-low",
    divider: "border-border/50",
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
        "overflow-hidden rounded-[var(--radius-card)] border p-3 sm:p-3.5",
        styles.shell,
        className,
      )}
    >
      <div
        className={cn(
          "mb-3 flex items-center gap-2 border-b pb-2.5",
          styles.divider,
        )}
      >
        {Icon ? (
          <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/60 text-muted-foreground ring-1 ring-inset ring-border/50">
            <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3 className="text-compact font-semibold text-foreground">{title}</h3>
          {badge}
        </div>
      </div>
      <SettingsProfileFieldGrid>{children}</SettingsProfileFieldGrid>
    </section>
  );
}
