"use client";

import { cn } from "@/lib/utils";

export type AdminFamilyGroupProgressRingVariant = "empty" | "idle" | "active" | "strong" | "complete";

type AdminFamilyGroupProgressRingProps = {
  progressPct: number;
  goalsCount: number;
  className?: string;
};

function resolveProgressVariant(
  progressPct: number,
  goalsCount: number,
): AdminFamilyGroupProgressRingVariant {
  if (goalsCount === 0) return "empty";
  if (progressPct >= 100) return "complete";
  if (progressPct >= 75) return "strong";
  if (progressPct > 0) return "active";
  return "idle";
}

export function AdminFamilyGroupProgressRing({
  progressPct,
  goalsCount,
  className,
}: AdminFamilyGroupProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, progressPct));
  const variant = resolveProgressVariant(clamped, goalsCount);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const showPct = goalsCount > 0;

  return (
    <div
      className={cn(
        "admin-family-group-progress-ring",
        `admin-family-group-progress-ring--${variant}`,
        className,
      )}
      aria-label={
        goalsCount === 0
          ? "Not applicable — no active goals"
          : `${clamped}% aggregate goal progress across ${goalsCount} ${goalsCount === 1 ? "goal" : "goals"}`
      }
      role="img"
    >
      <svg viewBox="0 0 48 48" className="admin-family-group-progress-ring__svg">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          className="admin-family-group-progress-ring__track"
        />
        {showPct ? (
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="admin-family-group-progress-ring__value"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 24 24)"
          />
        ) : null}
      </svg>
      <div className="admin-family-group-progress-ring__center">
        {goalsCount === 0 ? (
          <span className="admin-family-group-progress-ring__na tabular-nums">NA</span>
        ) : (
          <>
            <span className="admin-family-group-progress-ring__pct tabular-nums">{clamped}%</span>
            <span className="admin-family-group-progress-ring__goals tabular-nums">
              {goalsCount} {goalsCount === 1 ? "goal" : "goals"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
