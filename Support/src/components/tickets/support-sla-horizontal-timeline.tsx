import { Check } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { SupportSlaHorizontalStep } from "@/lib/support-types";
import { cn } from "@/lib/utils";

function stepDotClass(status: SupportSlaHorizontalStep["status"]) {
  if (status === "completed") {
    return "border-primary bg-primary text-primary-foreground";
  }
  if (status === "current") {
    return "border-2 border-primary bg-card text-primary";
  }
  return "border-2 border-border bg-card text-muted-foreground";
}

export function SupportSlaHorizontalTimeline({ steps }: { steps: SupportSlaHorizontalStep[] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex w-full min-w-[40rem]">
        {steps.map((step, index) => {
          const isFirst = index === 0;
          const isLast = index === steps.length - 1;
          const previousStep = index > 0 ? steps[index - 1] : null;
          const badgeVariant = (step.badgeVariant ?? "neutral") as StatusBadgeVariant;

          const leftLinePrimary = previousStep?.status === "completed";
          const rightLinePrimary = step.status === "completed";

          return (
            <li key={step.id} className="flex min-w-0 flex-1 flex-col items-stretch">
              <div className="flex w-full items-center">
                {isFirst ? (
                  <span className="h-0.5 flex-1 bg-transparent" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "h-0.5 flex-1",
                      leftLinePrimary ? "bg-primary" : "bg-border",
                    )}
                    aria-hidden
                  />
                )}

                <span
                  className={cn(
                    "relative z-10 mx-1 flex size-8 shrink-0 items-center justify-center rounded-full",
                    stepDotClass(step.status),
                  )}
                >
                  {step.status === "completed" ? (
                    <Check className="size-4" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <span
                      className={cn(
                        "rounded-full",
                        step.status === "current" ? "size-2.5 bg-primary" : "size-2 bg-muted-foreground",
                      )}
                      aria-hidden
                    />
                  )}
                </span>

                {isLast ? (
                  <span className="h-0.5 flex-1 bg-transparent" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "h-0.5 flex-1",
                      rightLinePrimary ? "bg-primary" : "bg-border",
                    )}
                    aria-hidden
                  />
                )}
              </div>

              <div className="mt-4 flex flex-col items-center px-2 text-center">
                <p className="text-compact font-semibold text-foreground">{step.label}</p>
                <p className="mt-1 text-caption text-muted-foreground">{step.dateLabel}</p>
                {step.detailLabel ? (
                  <p className="mt-0.5 text-caption text-muted-foreground">{step.detailLabel}</p>
                ) : null}
                {step.badgeLabel ? (
                  <StatusBadge variant={badgeVariant} className="mt-2 normal-case">
                    {step.badgeLabel}
                  </StatusBadge>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
