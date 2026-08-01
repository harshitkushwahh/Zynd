"use client";

import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type AddInvestorWizardProgressStep = {
  id: string;
  label: string;
  icon: LucideIcon;
  optional?: boolean;
};

type AddInvestorWizardProgressProps = {
  steps: AddInvestorWizardProgressStep[];
  activeIndex: number;
  /** Distribute steps evenly — used when there are many compliance steps. */
  equalWidth?: boolean;
  className?: string;
};

export function AddInvestorWizardProgress({
  steps,
  activeIndex,
  equalWidth = false,
  className,
}: AddInvestorWizardProgressProps) {
  return (
    <div
      className={cn(
        "add-investor-onboarding-wizard__progress",
        equalWidth && "add-investor-wizard-progress--equal",
        className,
      )}
      aria-hidden
    >
      {steps.map((item, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        const lineDone = index > 0 && index <= activeIndex;
        const Icon = item.icon;
        return (
          <Fragment key={item.id}>
            {index > 0 ? (
              <span
                className={cn(
                  "add-investor-onboarding-wizard__progress-line",
                  lineDone && "add-investor-onboarding-wizard__progress-line--done",
                )}
              />
            ) : null}
            <div
              className={cn(
                "add-investor-onboarding-wizard__progress-step",
                done && "add-investor-onboarding-wizard__progress-step--done",
                active && "add-investor-onboarding-wizard__progress-step--active",
              )}
            >
              <span className="add-investor-onboarding-wizard__progress-marker">
                {done ? (
                  <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
                ) : (
                  <Icon className="size-3.5" strokeWidth={2.25} />
                )}
              </span>
              <span className="add-investor-onboarding-wizard__progress-label-row">
                <span className="add-investor-onboarding-wizard__progress-label">{item.label}</span>
                {item.optional ? (
                  <span className="add-investor-onboarding-wizard__progress-optional">Optional</span>
                ) : null}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
