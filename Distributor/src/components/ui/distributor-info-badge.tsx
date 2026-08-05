"use client";

import type { LucideIcon } from "lucide-react";
import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type DistributorInfoBadgeProps = {
  /** Short code line (e.g. branch code). */
  code?: string;
  /** Primary label (e.g. branch name). */
  label: string;
  icon?: LucideIcon;
  className?: string;
  title?: string;
  "aria-label"?: string;
};

export function DistributorInfoBadge({
  code,
  label,
  icon: Icon = Building2,
  className,
  title,
  "aria-label": ariaLabel,
}: DistributorInfoBadgeProps) {
  const resolvedTitle = title ?? (code ? `${code} · ${label}` : label);
  const resolvedAriaLabel =
    ariaLabel ?? (code ? `${label}, code ${code}` : label);

  return (
    <div
      className={cn("distributor-info-badge", className)}
      title={resolvedTitle}
      aria-label={resolvedAriaLabel}
    >
      <span className="distributor-info-badge__icon" aria-hidden>
        <Icon className="size-3.5" strokeWidth={2.25} />
      </span>
      <span className="distributor-info-badge__body">
        {code ? <span className="distributor-info-badge__code">{code}</span> : null}
        <span className="distributor-info-badge__label">{label}</span>
      </span>
    </div>
  );
}
