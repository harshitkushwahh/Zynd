"use client";

import { Timer } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type RiskAssessmentDurationBadgeProps = {
  className?: string;
};

export function RiskAssessmentDurationBadge({ className }: RiskAssessmentDurationBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border border-primary/15",
        "bg-primary/[0.06] py-1 pl-1 pr-3",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        <Timer className="size-3.5" strokeWidth={2.25} />
      </span>

      <span className="text-compact font-semibold tabular-nums tracking-tight text-primary">
        {copy.riskProfile.assessmentHeaderBadge}
      </span>
    </div>
  );
}
