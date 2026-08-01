"use client";

import { type ReactNode } from "react";

import { AddInvestorWizardPanelShell } from "@/components/add-investor/add-investor-wizard-panel-shell";
import { AddInvestorWizardProgress } from "@/components/add-investor/add-investor-wizard-progress";
import type {
  AddInvestorJourneyStep,
  AddInvestorStepId,
} from "@/lib/add-investor/add-investor-journey";

type AddInvestorCompliancePanelShellProps = {
  journeySteps: AddInvestorJourneyStep[];
  stepId: AddInvestorStepId;
  footer: ReactNode;
  children: ReactNode;
};

export function AddInvestorCompliancePanelShell({
  journeySteps,
  stepId,
  footer,
  children,
}: AddInvestorCompliancePanelShellProps) {
  const complianceSteps = journeySteps.filter((item) => item.phase === "compliance");
  const stepIndex = complianceSteps.findIndex((item) => item.id === stepId);

  return (
    <AddInvestorWizardPanelShell
      title="Compliance"
      progress={
        <AddInvestorWizardProgress
          steps={complianceSteps}
          activeIndex={Math.max(stepIndex, 0)}
          equalWidth
        />
      }
      footer={footer}
    >
      {children}
    </AddInvestorWizardPanelShell>
  );
}
