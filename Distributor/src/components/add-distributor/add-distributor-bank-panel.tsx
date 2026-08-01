"use client";

import { Landmark } from "lucide-react";

import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AddDistributorBankDraft } from "@/lib/add-distributor/add-distributor-journey";

type AddDistributorBankPanelProps = {
  bank: AddDistributorBankDraft;
  onBankChange: (patch: Partial<AddDistributorBankDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
  continueDisabled: boolean;
};

export function AddDistributorBankPanel({
  bank,
  onBankChange,
  onBack,
  onContinue,
  canBack,
  continueDisabled,
}: AddDistributorBankPanelProps) {
  return (
    <AddDistributorWizardPanelShell
      stepId="bank"
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
      <div className="add-investor-onboarding-wizard__center add-distributor-bank-panel">
        <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
          <Landmark className="size-6" strokeWidth={2.25} />
        </span>
        <h3 className="add-investor-onboarding-wizard__title">Bank account</h3>
        <p className="add-investor-onboarding-wizard__desc">
          Enter the settlement account for trail and upfront commissions.
        </p>

        <div className="add-distributor-wizard-step-card">
          <div className="add-distributor-bank-panel__grid">
            <FieldGroup className="add-distributor-bank-panel__col">
              <Field>
                <FieldLabel htmlFor="dist-bank-holder">Account holder name</FieldLabel>
                <Input
                  id="dist-bank-holder"
                  value={bank.accountHolderName}
                  onChange={(event) => onBankChange({ accountHolderName: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dist-bank-name">Bank name</FieldLabel>
                <Input
                  id="dist-bank-name"
                  placeholder="e.g. HDFC Bank"
                  value={bank.bankName}
                  onChange={(event) => onBankChange({ bankName: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dist-ifsc">IFSC</FieldLabel>
                <Input
                  id="dist-ifsc"
                  value={bank.ifsc}
                  onChange={(event) =>
                    onBankChange({ ifsc: event.target.value.toUpperCase().replace(/\s/g, "").slice(0, 11) })
                  }
                  placeholder="HDFC0001234"
                  className="font-mono uppercase"
                />
              </Field>
            </FieldGroup>

            <FieldGroup className="add-distributor-bank-panel__col">
              <Field>
                <FieldLabel htmlFor="dist-account">Account number</FieldLabel>
                <Input
                  id="dist-account"
                  inputMode="numeric"
                  autoComplete="off"
                  value={bank.accountNumber}
                  onChange={(event) =>
                    onBankChange({ accountNumber: event.target.value.replace(/\D/g, "").slice(0, 18) })
                  }
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dist-account-confirm">Confirm account number</FieldLabel>
                <Input
                  id="dist-account-confirm"
                  inputMode="numeric"
                  autoComplete="off"
                  value={bank.confirmAccountNumber}
                  onChange={(event) =>
                    onBankChange({
                      confirmAccountNumber: event.target.value.replace(/\D/g, "").slice(0, 18),
                    })
                  }
                  className="font-mono"
                />
                {bank.confirmAccountNumber && bank.accountNumber !== bank.confirmAccountNumber ? (
                  <p className="text-caption text-destructive">Account numbers do not match.</p>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="dist-bank-branch">Branch (optional)</FieldLabel>
                <Input
                  id="dist-bank-branch"
                  placeholder="e.g. Andheri West"
                  value={bank.branchName ?? ""}
                  onChange={(event) => onBankChange({ branchName: event.target.value })}
                />
              </Field>
            </FieldGroup>
          </div>
        </div>
      </div>
    </AddDistributorWizardPanelShell>
  );
}
