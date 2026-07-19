import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type StatusBadgeVariant =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "neutral";

const variantConfig: Record<
  StatusBadgeVariant,
  { icon: LucideIcon; className: string }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-success/25 bg-success/10 text-success",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-warning/25 bg-warning/10 text-warning",
  },
  destructive: {
    icon: AlertCircle,
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  info: {
    icon: Info,
    className: "border-primary/25 bg-primary/10 text-primary",
  },
  neutral: {
    icon: Circle,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  icon?: LucideIcon;
  showIcon?: boolean;
  className?: string;
};

export function StatusBadge({
  variant,
  children,
  icon,
  showIcon = true,
  className,
}: StatusBadgeProps) {
  const config = variantConfig[variant];
  const Icon = icon ?? config.icon;

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-[var(--radius-control)] border px-2 text-tiny font-medium leading-none capitalize",
        config.className,
        className,
      )}
    >
      {showIcon ? <Icon className="size-3 shrink-0" strokeWidth={2.25} /> : null}
      {children}
    </span>
  );
}
