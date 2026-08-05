"use client";

import { cn } from "@/lib/utils";

export type AdminCircularProgressRingVariant = "empty" | "idle" | "active" | "strong" | "complete";

type AdminCircularProgressRingProps = {
  progressPct: number;
  primaryLabel: string;
  secondaryLabel?: string;
  empty?: boolean;
  size?: "sm" | "lg";
  className?: string;
  ariaLabel?: string;
};

function resolveProgressVariant(progressPct: number, empty: boolean): AdminCircularProgressRingVariant {
  if (empty) return "empty";
  if (progressPct >= 100) return "complete";
  if (progressPct >= 75) return "strong";
  if (progressPct > 0) return "active";
  return "idle";
}

export function AdminCircularProgressRing({
  progressPct,
  primaryLabel,
  secondaryLabel,
  empty = false,
  size = "sm",
  className,
  ariaLabel,
}: AdminCircularProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, progressPct));
  const variant = resolveProgressVariant(clamped, empty);
  const radius = size === "lg" ? 28 : 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const viewBox = size === "lg" ? "0 0 72 72" : "0 0 48 48";
  const center = size === "lg" ? 36 : 24;

  return (
    <div
      className={cn(
        "admin-circular-progress-ring",
        `admin-circular-progress-ring--${size}`,
        `admin-circular-progress-ring--${variant}`,
        className,
      )}
      aria-label={ariaLabel ?? `${primaryLabel}${secondaryLabel ? `, ${secondaryLabel}` : ""}`}
      role="img"
    >
      <svg viewBox={viewBox} className="admin-circular-progress-ring__svg">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={size === "lg" ? "4" : "3.5"}
          className="admin-circular-progress-ring__track"
        />
        {!empty ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={size === "lg" ? "4" : "3.5"}
            strokeLinecap="round"
            className="admin-circular-progress-ring__value"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </svg>
      <div className="admin-circular-progress-ring__center">
        <span className="admin-circular-progress-ring__primary tabular-nums">{primaryLabel}</span>
        {secondaryLabel ? (
          <span className="admin-circular-progress-ring__secondary tabular-nums">{secondaryLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

export function resolveGoalProgressRingVariant(
  progressPct: number,
): AdminCircularProgressRingVariant {
  return resolveProgressVariant(Math.max(0, Math.min(100, progressPct)), false);
}
