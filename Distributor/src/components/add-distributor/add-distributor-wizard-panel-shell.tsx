"use client";

import type { ReactNode } from "react";

import { AddInvestorWizardPanelShell } from "@/components/add-investor/add-investor-wizard-panel-shell";
import { AddInvestorWizardProgress } from "@/components/add-investor/add-investor-wizard-progress";
import {
  addDistributorStepIndex,
  addDistributorWizardProgressSteps,
  type AddDistributorStepId,
} from "@/lib/add-distributor/add-distributor-journey";
import { cn } from "@/lib/utils";

type AddDistributorWizardPanelShellProps = {
  stepId: AddDistributorStepId;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AddDistributorWizardPanelShell({
  stepId,
  title,
  meta,
  children,
  footer,
  className,
}: AddDistributorWizardPanelShellProps) {
  const activeIndex = addDistributorStepIndex(stepId);

  return (
    <AddInvestorWizardPanelShell
      title={title}
      meta={meta}
      className={cn("add-distributor-wizard-panel", className)}
      progress={
        <AddInvestorWizardProgress
          steps={addDistributorWizardProgressSteps()}
          activeIndex={activeIndex}
          equalWidth
        />
      }
      footer={footer}
    >
      {children}
    </AddInvestorWizardPanelShell>
  );
}
