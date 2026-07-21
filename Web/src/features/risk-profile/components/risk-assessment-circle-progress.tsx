"use client";

import { cn } from "@/lib/utils";

type RiskAssessmentCircleProgressProps = {
  current: number;
  total: number;
  variant?: "default" | "hero" | "inline";
  className?: string;
};

export function RiskAssessmentCircleProgress({
  current,
  total,
  variant = "default",
  className,
}: RiskAssessmentCircleProgressProps) {
  const clampedCurrent = Math.max(1, Math.min(current, total));
  const progress = total > 0 ? clampedCurrent / total : 0;
  const isHero = variant === "hero";
  const isInline = variant === "inline";
  const size = isInline ? 28 : 40;
  const strokeWidth = isInline ? 2.5 : 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full",
        isHero && "size-11 border border-primary-foreground/15 bg-primary-foreground/10 backdrop-blur-md",
        isInline && "size-7 border border-primary/15 bg-primary/10 backdrop-blur-sm",
        !isHero && !isInline && "size-10",
        className,
      )}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={clampedCurrent}
      aria-label={`Question ${clampedCurrent} of ${total}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={
            isHero ? "text-primary-foreground/25" : isInline ? "text-primary/25" : "text-border/80"
          }
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            "transition-[stroke-dashoffset] duration-300",
            isHero ? "text-primary-foreground" : "text-primary",
          )}
        />
      </svg>
      <span
        className={cn(
          "absolute font-semibold tabular-nums",
          isInline ? "text-[9px] text-primary" : "text-[10px]",
          isHero ? "text-primary-foreground" : !isInline && "text-foreground",
        )}
      >
        {clampedCurrent}/{total}
      </span>
    </div>
  );
}
