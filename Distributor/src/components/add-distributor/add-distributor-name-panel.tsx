"use client";

import { UserRound } from "lucide-react";

import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AddDistributorNameDraft } from "@/lib/add-distributor/add-distributor-journey";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type AddDistributorNamePanelProps = {
  name: AddDistributorNameDraft;
  onNameChange: (patch: Partial<AddDistributorNameDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
  continueDisabled: boolean;
};

export function AddDistributorNamePanel({
  name,
  onNameChange,
  onBack,
  onContinue,
  canBack,
  continueDisabled,
}: AddDistributorNamePanelProps) {
  return (
    <AddDistributorWizardPanelShell
      stepId="name"
      title="Onboarding"
      className="add-investor-wizard-panel--onboarding"
      footer={
        <AddInvestorWizardStepFooter
          onBack={onBack}
          onContinue={onContinue}
          canBack={canBack}
          continueDisabled={continueDisabled}
        />
      }
    >
      <div className="add-investor-onboarding-wizard__center add-distributor-name-panel">
        <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
          <UserRound className="size-6" strokeWidth={2.25} />
        </span>
        <h3 className="add-investor-onboarding-wizard__title">{ZYND_MITRA_COPY.legalName}</h3>
        <p className="add-investor-onboarding-wizard__desc">
          Legal name as it will appear on ARN records and commission payouts.
        </p>

        <div className="add-distributor-wizard-step-card">
          <FieldGroup>
            <div className="add-distributor-name-panel__row">
              <Field>
                <FieldLabel htmlFor="dist-first-name">First name</FieldLabel>
                <Input
                  id="dist-first-name"
                  autoComplete="given-name"
                  value={name.firstName}
                  onChange={(event) => onNameChange({ firstName: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dist-middle-name">Middle name (optional)</FieldLabel>
                <Input
                  id="dist-middle-name"
                  autoComplete="additional-name"
                  value={name.middleName}
                  onChange={(event) => onNameChange({ middleName: event.target.value })}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="dist-last-name">Last name</FieldLabel>
              <Input
                id="dist-last-name"
                autoComplete="family-name"
                value={name.lastName}
                onChange={(event) => onNameChange({ lastName: event.target.value })}
              />
            </Field>
          </FieldGroup>
        </div>
      </div>
    </AddDistributorWizardPanelShell>
  );
}
