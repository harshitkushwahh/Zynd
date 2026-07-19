import type { LucideIcon } from "lucide-react";
import { Ban, Construction, Inbox } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type AdminEmptyStateVariant = "coming-soon" | "disabled" | "no-data";
type AdminEmptyStatePadding = "sm" | "md" | "lg" | "xl" | "2xl";

const PADDING_CLASS: Record<AdminEmptyStatePadding, string> = {
  sm: "py-empty-state-sm",
  md: "py-empty-state-md",
  lg: "py-empty-state-lg",
  xl: "py-empty-state-xl",
  "2xl": "py-empty-state-2xl",
};

const VARIANT_CONFIG: Record<
  AdminEmptyStateVariant,
  {
    icon: LucideIcon;
    badge: string;
    badgeVariant: "info" | "neutral" | "warning";
    defaultTitle: (label: string) => string;
  }
> = {
  "coming-soon": {
    icon: Construction,
    badge: "Coming soon",
    badgeVariant: "info",
    defaultTitle: (label) => `${label} is under development`,
  },
  disabled: {
    icon: Ban,
    badge: "Not available yet",
    badgeVariant: "neutral",
    defaultTitle: (label) => `${label} is not ready`,
  },
  "no-data": {
    icon: Inbox,
    badge: "No data",
    badgeVariant: "neutral",
    defaultTitle: (label) => label,
  },
};

type AdminEmptyStateProps = {
  variant: AdminEmptyStateVariant;
  label: string;
  title?: string;
  description?: string;
  padding?: AdminEmptyStatePadding;
  className?: string;
};

export function AdminEmptyState({
  variant,
  label,
  title,
  description,
  padding = "2xl",
  className,
}: AdminEmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-border px-6 text-center",
        PADDING_CLASS[padding],
        className,
      )}
    >
      <div className="rounded-full bg-muted/40 p-4 text-muted-foreground">
        <Icon className="size-8" strokeWidth={1.75} />
      </div>
      <StatusBadge variant={config.badgeVariant} className="mt-5">
        {config.badge}
      </StatusBadge>
      <p className="mt-4 font-medium text-foreground">{title ?? config.defaultTitle(label)}</p>
      {description ? (
        <p className="mt-1 max-w-md text-caption leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
