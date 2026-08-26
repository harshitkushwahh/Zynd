import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export const SETTINGS_PROFILE_FIELD_CARD_CLASS =
  "relative flex min-h-0 flex-col justify-between overflow-hidden rounded-[var(--radius-control)] border border-border/60 bg-card p-3 shadow-zynd-low";

export const SETTINGS_PROFILE_FIELD_SKELETON_CLASS =
  "flex min-h-0 flex-col gap-2 rounded-[var(--radius-control)] border border-border/60 bg-card p-3";

type FieldVariant = "default" | "verified" | "accent";

const VARIANT_STYLES: Record<FieldVariant, string> = {
  default: "",
  verified: "border-success/20 bg-card ring-1 ring-success/10",
  accent: "border-border/60 bg-card",
};

type SettingsProfileFieldCardProps = {
  label: string;
  value: string;
  verified?: boolean;
  mono?: boolean;
  icon?: LucideIcon;
  variant?: FieldVariant;
  multiline?: boolean;
  className?: string;
};

export function SettingsProfileFieldCard({
  label,
  value,
  verified,
  mono,
  icon: Icon,
  variant = "default",
  multiline = false,
  className,
}: SettingsProfileFieldCardProps) {
  const resolvedVariant = verified ? "verified" : variant;

  return (
    <div
      className={cn(
        SETTINGS_PROFILE_FIELD_CARD_CLASS,
        VARIANT_STYLES[resolvedVariant],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {Icon ? (
            <div className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/60 text-muted-foreground ring-1 ring-inset ring-border/50">
              <Icon className="size-3" strokeWidth={2.25} aria-hidden />
            </div>
          ) : null}
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </span>
        </div>
        {verified ? (
          <StatusBadge variant="success" className="h-5 shrink-0 px-1.5 text-[9px]">
            Verified
          </StatusBadge>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1.5 text-compact font-medium leading-snug text-foreground",
          Icon && "pl-[1.875rem]",
          mono && "font-mono text-caption uppercase tracking-[0.1em]",
          multiline && "whitespace-pre-line leading-relaxed",
        )}
      >
        {value || "Not provided"}
      </p>
    </div>
  );
}

export function SettingsProfileFieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}
