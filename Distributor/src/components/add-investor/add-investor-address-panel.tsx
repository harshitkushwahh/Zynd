"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Home, Mail } from "lucide-react";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  AddInvestorAddressDraft,
  AddInvestorAddressFields,
} from "@/lib/add-investor/add-investor-journey";
import { ADD_INVESTOR_COUNTRY_OPTIONS, getAddInvestorCountryLabel } from "@/lib/add-investor/add-investor-journey";
import { ADD_INVESTOR_INDIAN_STATES } from "@/lib/add-investor/add-investor-address-options";
import {
  lookupAddInvestorEnumLabel,
  resolveAddInvestorStateOption,
  type AddInvestorKycMasterData,
} from "@/lib/add-investor/add-investor-kyc-master-data";
import { fetchDistributorKycPincode } from "@/lib/distributor-kyc-master-data-api";
import { cn } from "@/lib/utils";

type AddressTab = "permanent" | "correspondence";

const ADDRESS_TABS: Array<{
  id: AddressTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: "permanent", label: "Permanent address", icon: Home },
  { id: "correspondence", label: "Correspondence address", icon: Mail },
];

type AddInvestorAddressPanelProps = {
  address: AddInvestorAddressDraft;
  onAddressChange: (address: AddInvestorAddressDraft) => void;
  permanentReadOnly?: boolean;
  prefilledFromDigilocker?: boolean;
  addressMasterData?: Pick<AddInvestorKycMasterData, "states" | "countries"> | null;
};

function normalizeCountryValue(
  country: string,
  countryOptions: ReadonlyArray<{ value: string; label: string }>,
): string {
  const option = countryOptions.find(
    (item) => item.value === country || item.label === country,
  );
  if (option) return option.value;
  const legacy = ADD_INVESTOR_COUNTRY_OPTIONS.find(
    (item) => item.value === country || item.label === country,
  );
  return legacy?.label ?? country;
}

function formatAddressLine(fields: AddInvestorAddressFields): string {
  return [
    fields.line1,
    fields.line2,
    fields.city,
    fields.state,
    fields.pincode,
    getAddInvestorCountryLabel(fields.country),
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatAddInvestorAddressSummary(address: AddInvestorAddressDraft): string {
  const permanent = formatAddressLine(address.permanent);
  if (address.correspondenceSame) {
    return permanent;
  }
  const correspondence = formatAddressLine(address.correspondence);
  return `${permanent} · Correspondence: ${correspondence}`;
}

export function formatAddInvestorAddressReviewItems(
  address: AddInvestorAddressDraft,
): Array<{ label: string; value: string; tone?: "default" | "muted" }> {
  const permanent = formatAddressLine(address.permanent);
  const items: Array<{ label: string; value: string; tone?: "default" | "muted" }> = [
    { label: "Permanent", value: permanent },
  ];

  if (address.correspondenceSame) {
    items.push({ label: "Correspondence", value: "Same as permanent", tone: "muted" });
  } else {
    items.push({ label: "Correspondence", value: formatAddressLine(address.correspondence) });
  }

  return items.filter((item) => item.value.trim());
}

export function AddInvestorAddressPanel({
  address,
  onAddressChange,
  permanentReadOnly = false,
  prefilledFromDigilocker = false,
  addressMasterData,
}: AddInvestorAddressPanelProps) {
  const [activeTab, setActiveTab] = useState<AddressTab>("permanent");
  const pincodeEnrichedRef = useRef(false);

  const stateOptions = addressMasterData?.states ?? [...ADD_INVESTOR_INDIAN_STATES];
  const countryOptions =
    addressMasterData?.countries ??
    ADD_INVESTOR_COUNTRY_OPTIONS.map((item) => ({ label: item.label, value: item.label }));

  const updateFields = (type: AddressTab, patch: Partial<AddInvestorAddressFields>) => {
    const nextFields = {
      ...address[type],
      ...patch,
    };

    onAddressChange({
      ...address,
      [type]: nextFields,
      ...(type === "permanent" && address.correspondenceSame
        ? { correspondence: nextFields }
        : {}),
    });
  };

  const handleCorrespondenceSameChange = (checked: boolean) => {
    onAddressChange({
      ...address,
      correspondenceSame: checked,
      correspondence: checked ? { ...address.permanent } : address.correspondence,
    });
    if (checked) {
      setActiveTab("permanent");
    } else {
      setActiveTab("correspondence");
    }
  };

  const activeFields = activeTab === "permanent" ? address.permanent : address.correspondence;
  const fieldsReadOnly = activeTab === "permanent" && permanentReadOnly;
  const correspondenceTabDisabled = address.correspondenceSame;
  const countryValue = normalizeCountryValue(activeFields.country, countryOptions) || "India";
  const stateValue = resolveAddInvestorStateOption(activeFields.state, stateOptions);

  const applyPincodeLookup = async (pincode: string, type: AddressTab) => {
    if (pincode.length !== 6) return;
    try {
      const result = await fetchDistributorKycPincode(pincode);
      const nextFields = {
        ...(type === "permanent" ? address.permanent : address.correspondence),
        city: result.city || activeFields.city,
        state: resolveAddInvestorStateOption(result.state_name || activeFields.state, stateOptions),
        country: lookupAddInvestorEnumLabel("India", countryOptions) || "India",
      };
      onAddressChange({
        ...address,
        [type]: nextFields,
        ...(type === "permanent" && address.correspondenceSame
          ? { correspondence: nextFields }
          : {}),
      });
    } catch {
      // User can still enter city/state manually.
    }
  };

  useEffect(() => {
    if (!prefilledFromDigilocker || pincodeEnrichedRef.current) return;
    const pincode = address.permanent.pincode ?? "";
    if (pincode.length !== 6) return;
    pincodeEnrichedRef.current = true;
    void applyPincodeLookup(pincode, "permanent");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enrich once from DigiLocker pincode
  }, [address.permanent.pincode, prefilledFromDigilocker]);

  const handleStateChange = (value: string | null) => {
    if (!value) return;
    updateFields(activeTab, { state: value });
  };

  return (
    <div className="add-investor-onboarding-wizard__center add-investor-address-panel">
      <div className="add-investor-address-panel__tabs" role="tablist" aria-label="Address type">
        {ADDRESS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const isDisabled = tab.id === "correspondence" && correspondenceTabDisabled;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={isDisabled}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "add-investor-address-panel__tab",
                isActive && "add-investor-address-panel__tab--active",
                isDisabled && "add-investor-address-panel__tab--disabled",
              )}
            >
              <span className="add-investor-address-panel__tab-icon" aria-hidden>
                <TabIcon strokeWidth={2.1} />
              </span>
              <span className="add-investor-address-panel__tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "permanent" ? (
        <div className="add-investor-address-panel__same-toggle">
          <Switch
            id="addr-same"
            checked={address.correspondenceSame}
            onCheckedChange={handleCorrespondenceSameChange}
          />
          <Label htmlFor="addr-same" className="add-investor-address-panel__same-toggle-label">
            Correspondence same as permanent
          </Label>
        </div>
      ) : null}

      <div
        className="add-investor-address-panel__content"
        role="tabpanel"
        aria-label={
          activeTab === "permanent" ? "Permanent address details" : "Correspondence address details"
        }
      >
        <FieldGroup className="add-investor-address-panel__fields">
          <div className="add-investor-address-panel__fields-grid">
            <div className="add-investor-address-panel__fields-main">
              <Field>
                <FieldLabel htmlFor={`addr-${activeTab}-line1`}>Address line 1</FieldLabel>
                <Input
                  id={`addr-${activeTab}-line1`}
                  value={activeFields.line1}
                  readOnly={fieldsReadOnly}
                  onChange={(event) => updateFields(activeTab, { line1: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`addr-${activeTab}-line2`}>Address line 2</FieldLabel>
                <Input
                  id={`addr-${activeTab}-line2`}
                  value={activeFields.line2}
                  readOnly={fieldsReadOnly}
                  onChange={(event) => updateFields(activeTab, { line2: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`addr-${activeTab}-pin`}>PIN code</FieldLabel>
                <Input
                  id={`addr-${activeTab}-pin`}
                  inputMode="numeric"
                  maxLength={6}
                  value={activeFields.pincode}
                  readOnly={fieldsReadOnly}
                  onChange={(event) =>
                    updateFields(activeTab, {
                      pincode: event.target.value.replace(/\D/g, "").slice(0, 6),
                    })
                  }
                  onBlur={() => {
                    if (activeFields.pincode.length === 6) {
                      void applyPincodeLookup(activeFields.pincode, activeTab);
                    }
                  }}
                />
              </Field>
            </div>

            <div className="add-investor-address-panel__fields-location">
              <Field>
                <FieldLabel htmlFor={`addr-${activeTab}-state`}>State</FieldLabel>
                <Select
                  value={stateValue}
                  onValueChange={handleStateChange}
                  disabled={fieldsReadOnly}
                >
                  <SelectTrigger id={`addr-${activeTab}-state`} className="add-investor-address-panel__select">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {stateOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`addr-${activeTab}-city`}>City</FieldLabel>
                <Input
                  id={`addr-${activeTab}-city`}
                  value={activeFields.city}
                  readOnly={fieldsReadOnly}
                  onChange={(event) => updateFields(activeTab, { city: event.target.value })}
                  placeholder="Enter city"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`addr-${activeTab}-country`}>Country</FieldLabel>
                <Select
                  value={countryValue}
                  onValueChange={(value) => updateFields(activeTab, { country: value ?? "India" })}
                  disabled={fieldsReadOnly}
                >
                  <SelectTrigger id={`addr-${activeTab}-country`} className="add-investor-address-panel__select">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </FieldGroup>
      </div>

      {prefilledFromDigilocker && activeTab === "permanent" ? (
        <div className="add-investor-address-panel__digilocker-note" role="note">
          <span className="add-investor-address-panel__digilocker-note-logo" aria-hidden>
            <Image
              src="/digi.png"
              alt=""
              width={72}
              height={28}
              className="add-investor-address-panel__digilocker-note-logo-image"
            />
          </span>
          <div className="add-investor-address-panel__digilocker-note-copy">
            <p className="add-investor-address-panel__digilocker-note-title">Prefilled from DigiLocker</p>
            <p className="add-investor-address-panel__digilocker-note-desc">
              Permanent address was fetched from Aadhaar. Review each field and edit if anything looks off.
            </p>
          </div>
          <CheckCircle2
            className="add-investor-address-panel__digilocker-note-status"
            strokeWidth={2.25}
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  );
}
