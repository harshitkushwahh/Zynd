"use client";

import { cn } from "@/lib/utils";

export function AdminOverviewStatCell({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "muted";
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-success/20 bg-success/5"
      : tone === "warning"
        ? "border-warning/20 bg-warning/5"
        : tone === "muted"
          ? "border-border bg-muted/20"
          : "border-border bg-background";

  return (
    <div className={cn("admin-overview-stat-cell", toneClass, className)}>
      <p className="admin-overview-stat-cell__label">{label}</p>
      <p className="admin-overview-stat-cell__value tabular-nums">{value}</p>
      {hint ? <p className="admin-overview-stat-cell__hint">{hint}</p> : null}
    </div>
  );
}
