"use client";

import { KYC_JOURNEY_STEPS, type KycJourneyStep } from "@/features/kyc/lib/kyc-journey";
import { cn } from "@/lib/utils";

type KycJourneyProgressProps = {
  activeStepIndex: number;
  steps?: KycJourneyStep[];
  className?: string;
};

export function KycJourneyProgress({
  activeStepIndex,
  steps = KYC_JOURNEY_STEPS,
  className,
}: KycJourneyProgressProps) {
  return (
    <div
      className={cn("flex gap-1.5", className)}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={activeStepIndex + 1}
      aria-label={`Step ${activeStepIndex + 1} of ${steps.length}`}
    >
      {steps.map((step, index) => {
        const isComplete = index < activeStepIndex;
        const isActive = index === activeStepIndex;

        return (
          <div
            key={step.id}
            className={cn(
              "h-1 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
              isComplete && "bg-success",
              isActive && "bg-primary",
              !isComplete && !isActive && "bg-border/70",
            )}
          />
        );
      })}
    </div>
  );
}
