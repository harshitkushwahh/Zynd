"use client";

import { Share2, TrendingUp, Trophy, type LucideIcon } from "lucide-react";

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
      "col-span-1 lg:col-span-2 min-h-[220px] lg:min-h-[200px]",
      "bg-gradient-blue text-primary-foreground"
    ),
    illustration: Share2,
    illustrationClassName: "right-0 bottom-0 translate-x-[18%] translate-y-[18%]",
    illustrationIconClassName: "size-28 sm:size-32 lg:size-36",
  },
  {
    containerClassName: cn(
      "col-span-1 min-h-[220px] lg:min-h-[200px]",
      "bg-gradient-purple text-primary-foreground"
    ),
    illustration: TrendingUp,
    illustrationClassName: "right-0 top-0 translate-x-[22%] -translate-y-[22%]",
    illustrationIconClassName: "size-14 sm:size-16",
  },
  {
    containerClassName: cn(
      "col-span-1 lg:col-span-3 min-h-[140px] lg:min-h-[128px]",
      "bg-gradient-growth text-primary-foreground"
    ),
    illustration: Trophy,
    illustrationClassName: "right-0 bottom-0 translate-x-[12%] translate-y-[16%]",
    illustrationIconClassName: "size-20 sm:size-24 lg:size-28",
  },
];

function StepNumberBadge({ number }: { number: number }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        "border border-primary-foreground/25 bg-primary-foreground/10",
        "text-compact font-semibold tabular-nums text-primary-foreground"
      )}
      aria-hidden
    >
      {number}
    </span>
  );
}

function ReferralStepContent({
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
          illustrationClassName
        )}
        strokeWidth={1.25}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-full w-full max-w-md flex-col gap-3">
        <div className="flex items-center gap-3">
          <StepNumberBadge number={stepNumber} />
          <h3 className="text-h4 font-semibold tracking-tight text-primary-foreground">{label}</h3>
        </div>

        <p className="text-compact leading-relaxed text-primary-foreground/85">{description}</p>
      </div>
    </div>
  );
}

export function ReferralHowItWorksCard() {
  const steps = copy.referral.steps;

  return (
    <section className="space-y-3">
      <p className="text-compact font-semibold text-foreground">{copy.referral.stageTitle}</p>

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
        {steps.map((step, index) => {
          const config = STEP_CONFIG[index];
          if (!config) return null;

          return (
            <WobbleCard
              key={step.label}
              containerClassName={config.containerClassName}
              className="relative min-h-full"
            >
              <ReferralStepContent
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
