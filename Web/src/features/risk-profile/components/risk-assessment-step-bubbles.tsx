"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type RiskAssessmentStepBubblesProps = {
  totalSteps: number;
  currentStepIndex: number;
  answeredQuestionIds: string[];
  questionIds: string[];
  className?: string;
};

export function RiskAssessmentStepBubbles({
  totalSteps,
  currentStepIndex,
  answeredQuestionIds,
  questionIds,
  className,
}: RiskAssessmentStepBubblesProps) {
  const answeredSet = new Set(answeredQuestionIds);

  return (
    <div className={cn("w-full overflow-x-auto [scrollbar-width:thin]", className)}>
      <ol className="flex min-w-max items-center gap-0 px-0.5">
        {Array.from({ length: totalSteps }, (_, index) => {
          const isActive = index === currentStepIndex;
          const isComplete = Boolean(questionIds[index] && answeredSet.has(questionIds[index]));
          const isLast = index === totalSteps - 1;
          const connectorComplete = isComplete || index < currentStepIndex;

          return (
            <li key={index} className="flex items-center last:flex-none">
              <div className="flex shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border text-tiny font-semibold tabular-nums transition-colors",
                    isActive && "border-primary bg-primary text-primary-foreground shadow-sm",
                    !isActive && isComplete && "border-primary/30 bg-primary/10 text-primary",
                    !isActive && !isComplete && "border-border bg-muted/30 text-muted-foreground",
                  )}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Step ${index + 1}${isComplete ? ", completed" : isActive ? ", current" : ""}`}
                >
                  {isComplete && !isActive ? <Check className="size-3.5" strokeWidth={2.5} /> : index + 1}
                </span>
              </div>
              {!isLast ? (
                <span
                  className={cn(
                    "mx-1.5 h-0.5 w-6 rounded-full sm:w-8",
                    connectorComplete ? "bg-primary/35" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
