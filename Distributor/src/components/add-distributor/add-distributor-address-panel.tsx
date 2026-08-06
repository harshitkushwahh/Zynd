"use client";

import { Home } from "lucide-react";

import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AddDistributorAddressDraft } from "@/lib/add-distributor/add-distributor-journey";
import {
  ADD_INVESTOR_COUNTRY_OPTIONS,
  getAddInvestorCountryLabel,
} from "@/lib/add-investor/add-investor-journey";
import {
  ADD_INVESTOR_INDIAN_STATES,
  resolveAddInvestorCityOptions,
  resolveAddInvestorStateOption,
} from "@/lib/add-investor/add-investor-address-options";

type AddDistributorAddressPanelProps = {
  address: AddDistributorAddressDraft;
  onAddressChange: (patch: Partial<AddDistributorAddressDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
  continueDisabled: boolean;
};

function normalizeCountryValue(country: string): string {
  const option = ADD_INVESTOR_COUNTRY_OPTIONS.find(
    (item) => item.value === country || item.label === country,
  );
  return option?.value ?? country;
}

export function formatDistributorAddressLine(address: AddDistributorAddressDraft): string {
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode,
    getAddInvestorCountryLabel(address.country),
  ]
    .filter(Boolean)
    .join(", ");
}

export function AddDistributorAddressPanel({
  address,
  onAddressChange,
  onBack,
  onContinue,
  canBack,
  continueDisabled,
}: AddDistributorAddressPanelProps) {
  const stateValue = resolveAddInvestorStateOption(address.state);
  const cityOptions = resolveAddInvestorCityOptions(stateValue || address.state, address.city);
  const trimmedCity = address.city.trim();
  const cityValue = trimmedCity && cityOptions.includes(trimmedCity) ? trimmedCity : "";
  const countryValue = normalizeCountryValue(address.country) || "india";

  const handleStateChange = (value: string | null) => {
    if (!value) return;
    const nextCities = resolveAddInvestorCityOptions(value, "");
    const keepsCity = nextCities.includes(address.city.trim());
    onAddressChange({
      state: value,
      ...(keepsCity ? {} : { city: "" }),
    });
  };

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
          <FieldGroup className="add-distributor-address-panel__fields">
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

            <div className="add-investor-bank-panel__row">
              <Field>
                <FieldLabel htmlFor="dist-addr-state">State</FieldLabel>
                <Select value={stateValue} onValueChange={handleStateChange}>
                  <SelectTrigger id="dist-addr-state" className="add-investor-bank-panel__select">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADD_INVESTOR_INDIAN_STATES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="dist-addr-city">City</FieldLabel>
                <Select
                  value={cityValue}
                  onValueChange={(value) => onAddressChange({ city: value ?? "" })}
                  disabled={!stateValue && cityOptions.length === 0}
                >
                  <SelectTrigger id="dist-addr-city" className="add-investor-bank-panel__select">
                    <SelectValue placeholder={stateValue ? "Select city" : "Select state first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="dist-addr-country">Country</FieldLabel>
              <Select
                value={countryValue}
                onValueChange={(value) => onAddressChange({ country: value ?? "India" })}
              >
                <SelectTrigger id="dist-addr-country" className="add-investor-bank-panel__select">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {ADD_INVESTOR_COUNTRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </div>
      </div>
    </AddDistributorWizardPanelShell>
  );
}
