"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

const variantConfig: Record<
  StatusBadgeVariant,
  { icon: LucideIcon; containerClassName: string; iconClassName: string; textClassName: string }
> = {
  success: {
    icon: CheckCircle2,
    containerClassName: "border-success/30 bg-success/10",
    iconClassName: "text-success",
    textClassName: "text-foreground",
  },
  warning: {
    icon: AlertTriangle,
    containerClassName: "border-warning/30 bg-warning/10",
    iconClassName: "text-warning",
    textClassName: "text-foreground",
  },
  destructive: {
    icon: AlertCircle,
    containerClassName: "border-destructive/30 bg-destructive/10",
    iconClassName: "text-destructive",
    textClassName: "text-destructive",
  },
  info: {
    icon: Info,
    containerClassName: "border-primary/25 bg-primary/10",
    iconClassName: "text-primary",
    textClassName: "text-foreground",
  },
  neutral: {
    icon: Circle,
    containerClassName: "border-border bg-muted/30",
    iconClassName: "text-muted-foreground",
    textClassName: "text-muted-foreground",
  },
};

type AdminFeedbackMessageProps = {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  title?: string;
  icon?: LucideIcon;
  showIcon?: boolean;
  className?: string;
};

export function AdminFeedbackMessage({
  variant,
  children,
  title,
  icon,
  showIcon = true,
  className,
}: AdminFeedbackMessageProps) {
  const config = variantConfig[variant];
  const Icon = icon ?? config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2.5",
        config.containerClassName,
        className,
      )}
      role="status"
    >
      {showIcon ? (
        <Icon className={cn("mt-0.5 size-4 shrink-0", config.iconClassName)} strokeWidth={2.25} />
      ) : null}
      <div className="min-w-0">
        {title ? (
          <p className={cn("font-medium text-compact", config.textClassName)}>{title}</p>
        ) : null}
        <p
          className={cn(
            "text-compact leading-relaxed",
            config.textClassName,
            title ? "mt-1 text-muted-foreground" : undefined,
          )}
        >
          {children}
        </p>
      </div>
    </div>
  );
}
