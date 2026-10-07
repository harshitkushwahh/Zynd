"use client";

import { cn } from "@/lib/utils";

export type SplitFormStepItem = {
  step: number;
  label: string;
};

type SplitFormStepProgressProps = {
  steps: SplitFormStepItem[];
  currentStep: number;
  className?: string;
};

export function SplitFormStepProgress({ steps, currentStep, className }: SplitFormStepProgressProps) {
  return (
    <ol className={cn("flex gap-2", className)} aria-label="Progress">
      {steps.map(({ step, label }) => {
        const done = step < currentStep;
        const active = step === currentStep;
        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold tabular-nums",
                  done && "bg-success text-success-foreground",
                  active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {step}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate text-caption font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                done ? "bg-success" : active ? "bg-primary" : "bg-border",
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}
