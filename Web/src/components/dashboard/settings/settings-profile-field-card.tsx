import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export const SETTINGS_PROFILE_FIELD_CARD_CLASS =
  "relative flex min-h-[5.25rem] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border border-border/60 bg-card p-4 shadow-zynd-low transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/20 hover:shadow-zynd-mid";

export const SETTINGS_PROFILE_FIELD_SKELETON_CLASS =
  "flex min-h-[5.25rem] flex-col gap-2.5 rounded-[var(--radius-card)] border border-border/60 bg-card p-4";

type FieldVariant = "default" | "verified" | "accent";

const VARIANT_STYLES: Record<FieldVariant, string> = {
  default: "",
  verified: "border-success/25 bg-card ring-1 ring-success/10",
  accent: "border-primary/20 bg-card",
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
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/60 text-muted-foreground ring-1 ring-inset ring-border/50">
              <Icon className="size-3.5" strokeWidth={2} aria-hidden />
            </div>
          ) : null}
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
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
          "mt-3 text-body font-medium leading-snug text-foreground",
          Icon && "pl-9",
          mono && "font-mono text-compact uppercase tracking-[0.12em]",
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}
