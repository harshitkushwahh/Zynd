import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type StatusBadgeVariant = "success" | "warning" | "destructive" | "info" | "neutral";

const variantConfig: Record<
  StatusBadgeVariant,
  { icon: LucideIcon; className: string }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-transparent bg-success text-success-foreground",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-transparent bg-warning text-white",
  },
  destructive: {
    icon: AlertCircle,
    className: "border-transparent bg-destructive text-destructive-foreground",
  },
  info: {
    icon: Info,
    className: "border-transparent bg-info text-info-foreground",
  },
  neutral: {
    icon: Circle,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  children?: React.ReactNode;
  icon?: LucideIcon;
  showIcon?: boolean;
  /** Icon-only pill (e.g. SIP avatar corner badge). Pass `aria-label` for accessibility. */
  iconOnly?: boolean;
  "aria-label"?: string;
  className?: string;
};

export function StatusBadge({
  variant,
  children,
  icon,
  showIcon = true,
  iconOnly = false,
  "aria-label": ariaLabel,
  className,
}: StatusBadgeProps) {
  const config = variantConfig[variant];
  const Icon = icon ?? config.icon;

  if (iconOnly) {
    return (
      <span
        aria-label={ariaLabel ?? (typeof children === "string" ? children : undefined)}
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-full border p-0 leading-none",
          config.className,
          variant === "warning" && "[&_svg]:translate-y-px",
          className,
        )}
      >
        <Icon className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 rounded-full border px-3 text-caption font-medium leading-none whitespace-nowrap",
        config.className,
        className
      )}
    >
      {showIcon ? <Icon className="size-3 shrink-0" strokeWidth={2.25} aria-hidden /> : null}
      {children ? <span className="shrink-0">{children}</span> : null}
    </span>
  );
}
