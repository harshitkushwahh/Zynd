"use client";

import { useEffect, useState } from "react";

import { ReferralProgressBadge, getReferralProgressBadgeConfig } from "@/features/referral/components/referral-progress-badge";
import { REFERRAL_STATUS_LABELS } from "@/features/referral/lib/referral-display";
import { cn } from "@/lib/utils";

type ReferralStatusRingBadgeProps = {
  step: number;
  totalSteps?: number;
  size?: number;
  className?: string;
};

export function ReferralStatusRingBadge({
  step,
  totalSteps = 3,
  size = 44,
  className,
}: ReferralStatusRingBadgeProps) {
  const [animate, setAnimate] = useState(false);
  const { step: clampedStep } = getReferralProgressBadgeConfig(step, totalSteps);
  const progress = clampedStep / totalSteps;
  const percent = Math.round(progress * 100);
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - progress);
  const label = REFERRAL_STATUS_LABELS[clampedStep - 1] ?? REFERRAL_STATUS_LABELS[0]!;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={cn("flex shrink-0 items-center gap-2", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalSteps}
      aria-valuenow={clampedStep}
      aria-label={label}
    >
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border/70"
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
            strokeDashoffset={animate ? targetOffset : circumference}
            className={cn(
              "transition-[stroke-dashoffset] duration-700 ease-out",
              clampedStep >= totalSteps ? "text-success" : "text-primary"
            )}
          />
        </svg>
        <span className="relative text-[10px] font-semibold tabular-nums text-foreground">{percent}%</span>
      </div>

      <ReferralProgressBadge step={clampedStep} />
    </div>
  );
}
