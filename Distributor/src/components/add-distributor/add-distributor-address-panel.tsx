"use client";

import { Home } from "lucide-react";

import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AddDistributorAddressDraft } from "@/lib/add-distributor/add-distributor-journey";

type AddDistributorAddressPanelProps = {
  address: AddDistributorAddressDraft;
  onAddressChange: (patch: Partial<AddDistributorAddressDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
  continueDisabled: boolean;
};

export function AddDistributorAddressPanel({
  address,
  onAddressChange,
  onBack,
  onContinue,
  canBack,
  continueDisabled,
}: AddDistributorAddressPanelProps) {
  return (
    <AddDistributorWizardPanelShell
      stepId="address"
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
      <div className="add-investor-onboarding-wizard__center add-distributor-address-panel">
        <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
          <Home className="size-6" strokeWidth={2.25} />
        </span>
        <h3 className="add-investor-onboarding-wizard__title">Registered address</h3>
        <p className="add-investor-onboarding-wizard__desc">
          Office or correspondence address for branch records and AMFI compliance.
        </p>

        <div className="add-distributor-wizard-step-card">
          <div className="add-distributor-address-panel__grid">
            <FieldGroup className="add-distributor-address-panel__col">
              <Field>
                <FieldLabel htmlFor="dist-addr-line1">Address line 1</FieldLabel>
                <Input
                  id="dist-addr-line1"
                  value={address.line1}
                  onChange={(event) => onAddressChange({ line1: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dist-addr-line2">Address line 2 (optional)</FieldLabel>
                <Input
                  id="dist-addr-line2"
                  value={address.line2}
                  onChange={(event) => onAddressChange({ line2: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dist-addr-city">City</FieldLabel>
                <Input
                  id="dist-addr-city"
                  value={address.city}
                  onChange={(event) => onAddressChange({ city: event.target.value })}
                />
              </Field>
            </FieldGroup>

            <FieldGroup className="add-distributor-address-panel__col">
              <Field>
                <FieldLabel htmlFor="dist-addr-state">State</FieldLabel>
                <Input
                  id="dist-addr-state"
                  value={address.state}
                  onChange={(event) => onAddressChange({ state: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dist-addr-pin">PIN code</FieldLabel>
                <Input
                  id="dist-addr-pin"
                  inputMode="numeric"
                  maxLength={6}
                  value={address.pincode}
                  onChange={(event) =>
                    onAddressChange({ pincode: event.target.value.replace(/\D/g, "").slice(0, 6) })
                  }
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dist-addr-country">Country</FieldLabel>
                <Input
                  id="dist-addr-country"
                  value={address.country}
                  onChange={(event) => onAddressChange({ country: event.target.value })}
                />
              </Field>
            </FieldGroup>
          </div>
        </div>
      </div>
    </AddDistributorWizardPanelShell>
  );
}
