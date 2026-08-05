"use client";

import type { ReactNode } from "react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";

type AddInvestorWizardStepFooterProps = {
  onBack: () => void;
  onContinue: () => void;
  canBack?: boolean;
  continueDisabled?: boolean;
  backLabel?: string;
  continueLabel?: ReactNode;
};

export function AddInvestorWizardStepFooter({
  onBack,
  onContinue,
  canBack = true,
  continueDisabled = false,
  backLabel = "Back",
  continueLabel = "Continue",
}: AddInvestorWizardStepFooterProps) {
  return (
    <>
      <DistributorActionButton type="button" variant="outline" onClick={onBack} disabled={!canBack}>
        {backLabel}
      </DistributorActionButton>
      <DistributorActionButton type="button" onClick={onContinue} disabled={continueDisabled}>
        {continueLabel}
      </DistributorActionButton>
    </>
  );
}
