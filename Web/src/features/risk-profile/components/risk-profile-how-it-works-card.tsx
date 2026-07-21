"use client";

import { Lightbulb, Sparkles, Target, type LucideIcon } from "lucide-react";

import { WobbleCard } from "@/components/ui/wobble-card";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type StepConfig = {
  containerClassName: string;
  illustration: LucideIcon;
  illustrationClassName: string;
  illustrationIconClassName: string;
};

const STEP_CONFIG: StepConfig[] = [
  {
    containerClassName: cn(
      "col-span-1 min-h-[200px] sm:min-h-[180px]",
      "bg-gradient-blue text-primary-foreground",
    ),
    illustration: Sparkles,
    illustrationClassName: "right-0 bottom-0 translate-x-[18%] translate-y-[18%]",
    illustrationIconClassName: "size-20 sm:size-24",
  },
  {
    containerClassName: cn(
      "col-span-1 min-h-[200px] sm:min-h-[180px]",
      "bg-gradient-purple text-primary-foreground",
    ),
    illustration: Target,
    illustrationClassName: "right-0 top-0 translate-x-[22%] -translate-y-[22%]",
    illustrationIconClassName: "size-12 sm:size-14",
  },
  {
    containerClassName: cn(
      "col-span-2 min-h-[140px] sm:min-h-[128px]",
      "bg-gradient-growth text-primary-foreground",
    ),
    illustration: Lightbulb,
    illustrationClassName: "right-0 bottom-0 translate-x-[12%] translate-y-[16%]",
    illustrationIconClassName: "size-20 sm:size-24",
  },
];

function StepNumberBadge({ number }: { number: number }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        "border border-primary-foreground/25 bg-primary-foreground/10",
        "text-compact font-semibold tabular-nums text-primary-foreground",
      )}
      aria-hidden
    >
      {number}
    </span>
  );
}

function RiskProfileStepContent({
  stepNumber,
  label,
  description,
  illustration: Illustration,
  illustrationClassName,
  illustrationIconClassName,
}: {
  stepNumber: number;
  label: string;
  description: string;
  illustration: LucideIcon;
  illustrationClassName: string;
  illustrationIconClassName: string;
}) {
  return (
    <div className="relative isolate min-h-full w-full">
      <Illustration
        className={cn(
          "pointer-events-none absolute z-0 text-primary-foreground/18",
          illustrationIconClassName,
          illustrationClassName,
        )}
        strokeWidth={1.25}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-full w-full flex-col gap-3 text-left">
        <div className="flex items-start gap-2.5 sm:items-center sm:gap-3">
          <StepNumberBadge number={stepNumber} />
          <h3 className="text-compact font-semibold tracking-tight text-primary-foreground sm:text-body">
            {label}
          </h3>
        </div>

        <p className="text-caption leading-relaxed text-primary-foreground/85 sm:text-compact">{description}</p>
      </div>
    </div>
  );
}

export function RiskProfileHowItWorksCard() {
  const steps = copy.riskProfile.educationSteps;

  return (
    <section id="risk-profile-education" className="space-y-3">
      <p className="text-compact font-semibold text-foreground">{copy.riskProfile.educationTitle}</p>

      <div className="grid w-full min-w-0 grid-cols-2 gap-3">
        {steps.map((step, index) => {
          const config = STEP_CONFIG[index];
          if (!config) return null;

          return (
            <WobbleCard
              key={step.label}
              containerClassName={config.containerClassName}
              className="relative min-h-full"
            >
              <RiskProfileStepContent
                stepNumber={index + 1}
                label={step.label}
                description={step.description}
                illustration={config.illustration}
                illustrationClassName={config.illustrationClassName}
                illustrationIconClassName={config.illustrationIconClassName}
              />
            </WobbleCard>
          );
        })}
      </div>
    </section>
  );
}
