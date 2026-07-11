"use client";

import { cn } from "@/lib/utils";

type NomineeWizardCircleProgressProps = {
  step: number;
  totalSteps?: number;
  className?: string;
};

export function NomineeWizardCircleProgress({
  step,
  totalSteps = 3,
  className,
}: NomineeWizardCircleProgressProps) {
  const clampedStep = Math.max(0, Math.min(step, totalSteps));
  const progress = totalSteps > 0 ? clampedStep / totalSteps : 0;
  const size = 40;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className={cn("relative flex size-10 shrink-0 items-center justify-center", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalSteps}
      aria-valuenow={clampedStep}
      aria-label={`Nominee step ${clampedStep} of ${totalSteps}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border/80"
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
          className="text-primary transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold tabular-nums text-foreground">
        {clampedStep}/{totalSteps}
      </span>
    </div>
  );
}
