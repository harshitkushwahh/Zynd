"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

const variantConfig: Record<
  StatusBadgeVariant,
  { icon: LucideIcon; containerClassName: string; iconClassName: string; textClassName: string }
> = {
  success: {
    icon: CheckCircle2,
    containerClassName:
      "border-success/30 bg-success/10 dark:border-success/55 dark:bg-success/22",
    iconClassName: "text-success dark:text-emerald-300",
    textClassName: "text-foreground dark:text-emerald-100/95",
  },
  warning: {
    icon: AlertTriangle,
    containerClassName:
      "border-warning/30 bg-warning/10 dark:border-warning/55 dark:bg-warning/22",
    iconClassName: "text-warning dark:text-amber-300",
    textClassName: "text-foreground dark:text-amber-100/95",
  },
  destructive: {
    icon: AlertCircle,
    containerClassName:
      "border-destructive/30 bg-destructive/10 dark:border-destructive/55 dark:bg-destructive/22",
    iconClassName: "text-destructive dark:text-red-300",
    textClassName: "text-foreground dark:text-red-200/95",
  },
  info: {
    icon: Info,
    containerClassName:
      "border-primary/25 bg-primary/10 dark:border-info/55 dark:bg-info/22",
    iconClassName: "text-primary dark:text-sky-300",
    textClassName: "text-foreground dark:text-sky-100/95",
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
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
};

export function AdminFeedbackMessage({
  variant,
  children,
  title,
  icon,
  showIcon = true,
  dismissible = true,
  onDismiss,
  className,
}: AdminFeedbackMessageProps) {
  const config = variantConfig[variant];
  const Icon = icon ?? config.icon;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [children, title, variant]);

  if (hidden) {
    return null;
  }

  const handleDismiss = () => {
    onDismiss?.();
    setHidden(true);
  };

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2.5",
        config.containerClassName,
        className,
      )}
      role={variant === "destructive" ? "alert" : "status"}
    >
      {showIcon ? (
        <Icon className={cn("mt-0.5 size-4 shrink-0", config.iconClassName)} strokeWidth={2.25} />
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? (
          <p className={cn("font-medium text-compact", config.textClassName)}>{title}</p>
        ) : null}
        <div
          className={cn(
            "text-compact leading-relaxed",
            config.textClassName,
            title ? "mt-1 text-muted-foreground" : undefined,
          )}
        >
          {children}
        </div>
      </div>
      {dismissible ? (
        <button
          type="button"
          className="admin-feedback-message__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss message"
        >
          <X className="size-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
