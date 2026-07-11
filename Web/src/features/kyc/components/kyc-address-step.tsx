"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycSelectField } from "@/features/kyc/components/kyc-select-field";
import {
  createEmptyAddressForm,
  type KycAddressFields,
  type KycAddressFormValue,
} from "@/features/kyc/lib/kyc-address";
import {
  KYC_ADDRESS_LIMITS,
  validateKycAddressFields,
} from "@/features/kyc/lib/kyc-address-validation";
import { DEFAULT_KYC_COUNTRY, INDIAN_STATES } from "@/features/kyc/lib/indian-states";
import { fetchKycPincode } from "@/features/kyc/lib/kyc-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type AddressTab = "permanent" | "correspondence";

type KycAddressStepProps = {
  initialValue?: KycAddressFormValue;
  stateOptions?: string[];
  prefilledFromDigilocker?: boolean;
  saving?: boolean;
  onSubmit: (value: KycAddressFormValue) => void;
};

type AddressFieldKey = keyof KycAddressFields;

const FIELD_ORDER: AddressFieldKey[] = [
  "line1",
  "line2",
  "city",
  "state",
  "pincode",
  "country",
];

function getFieldLabel(key: AddressFieldKey) {
  return copy.kyc.address.fields[key];
}

function validateAddress(address: KycAddressFields) {
  return validateKycAddressFields(address);
}

function AddressFieldsForm({
  prefix,
  values,
  errors,
  disabled,
  stateOptions,
  onChange,
  onPincodeBlur,
}: {
  prefix: string;
  values: KycAddressFields;
  errors: Partial<Record<AddressFieldKey, string>>;
  disabled?: boolean;
  stateOptions: string[];
  onChange: (field: AddressFieldKey, value: string) => void;
  onPincodeBlur?: (pincode: string) => void;
}) {
  return (
    <div className="space-y-4">
      {FIELD_ORDER.map((field) => {
        if (field === "state" || field === "country") {
          return null;
        }

        if (field === "city") {
          return (
            <div key={`${prefix}-city-state`} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-city`}>{getFieldLabel("city")}</Label>
                <Input
                  id={`${prefix}-city`}
                  value={values.city}
                  onChange={(event) => onChange("city", event.target.value.slice(0, KYC_ADDRESS_LIMITS.city.max))}
                  placeholder={copy.kyc.address.placeholders.city}
                  disabled={disabled}
                  maxLength={KYC_ADDRESS_LIMITS.city.max}
                  aria-invalid={Boolean(errors.city)}
                />
                {errors.city ? <FieldMessage message={errors.city} /> : null}
              </div>
              <div className="space-y-2">
                <KycSelectField
                  id={`${prefix}-state`}
                  label={getFieldLabel("state")}
                  value={values.state}
                  options={stateOptions}
                  placeholder={copy.kyc.address.fields.statePlaceholder}
                  disabled={disabled}
                  hasError={Boolean(errors.state)}
                  onChange={(value) => onChange("state", value)}
                />
                {errors.state ? <FieldMessage message={errors.state} /> : null}
              </div>
            </div>
          );
        }

        if (field === "pincode") {
          return (
            <div key={`${prefix}-pincode-country`} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-pincode`}>{getFieldLabel("pincode")}</Label>
                <Input
                  id={`${prefix}-pincode`}
                  inputMode="numeric"
                  value={values.pincode}
                  onChange={(event) =>
                    onChange("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onBlur={() => {
                    if (values.pincode.length === 6) {
                      onPincodeBlur?.(values.pincode);
                    }
                  }}
                  placeholder={copy.kyc.address.placeholders.pincode}
                  disabled={disabled}
                  aria-invalid={Boolean(errors.pincode)}
                />
                {errors.pincode ? <FieldMessage message={errors.pincode} /> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-country`}>{getFieldLabel("country")}</Label>
                <Input
                  id={`${prefix}-country`}
                  value={DEFAULT_KYC_COUNTRY}
                  disabled
                  readOnly
                  aria-readonly="true"
                />
              </div>
            </div>
          );
        }

        return (
          <div key={`${prefix}-${field}`} className="space-y-2">
            <Label htmlFor={`${prefix}-${field}`}>{getFieldLabel(field)}</Label>
            <Input
              id={`${prefix}-${field}`}
              value={values[field]}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (field === "line1") {
                  onChange(field, nextValue.slice(0, KYC_ADDRESS_LIMITS.line1.max));
                  return;
                }
                if (field === "line2") {
                  onChange(field, nextValue.slice(0, KYC_ADDRESS_LIMITS.line2.max));
                  return;
                }
                onChange(field, nextValue);
              }}
              placeholder={copy.kyc.address.placeholders[field]}
              disabled={disabled}
              maxLength={field === "line1" ? KYC_ADDRESS_LIMITS.line1.max : KYC_ADDRESS_LIMITS.line2.max}
              aria-invalid={Boolean(errors[field])}
            />
            {errors[field] ? <FieldMessage message={errors[field]} /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function KycAddressStep({
  initialValue,
  stateOptions = [...INDIAN_STATES],
  prefilledFromDigilocker = false,
  saving = false,
  onSubmit,
}: KycAddressStepProps) {
  const [activeTab, setActiveTab] = useState<AddressTab>("permanent");
  const [form, setForm] = useState<KycAddressFormValue>(() => initialValue ?? createEmptyAddressForm());
  const [errors, setErrors] = useState<{
    permanent: Partial<Record<AddressFieldKey, string>>;
    correspondence: Partial<Record<AddressFieldKey, string>>;
  }>({ permanent: {}, correspondence: {} });

  useEffect(() => {
    if (initialValue) {
      setForm(initialValue);
    }
  }, [initialValue]);

  const applyPincodeLookup = async (pincode: string, type: "permanent" | "correspondence") => {
    try {
      const result = await fetchKycPincode(pincode);
      setForm((current) => ({
        ...current,
        [type]: {
          ...current[type],
          city: result.city || current[type].city,
          state: result.state_name || current[type].state,
          country: DEFAULT_KYC_COUNTRY,
        },
      }));
    } catch {
      // User can still enter city/state manually.
    }
  };

  const updateAddress = (
    type: "permanent" | "correspondence",
    field: AddressFieldKey,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [field]: value,
        country: DEFAULT_KYC_COUNTRY,
      },
    }));
    setErrors((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [field]: undefined,
      },
    }));
  };

  const handleSameAsPermanentChange = (checked: boolean) => {
    setForm((current) => ({
      ...current,
      sameAsPermanent: checked,
      correspondence: checked ? { ...current.permanent, country: DEFAULT_KYC_COUNTRY } : current.correspondence,
    }));
    if (checked) {
      setActiveTab("permanent");
      setErrors((current) => ({ ...current, correspondence: {} }));
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const permanentErrors = validateAddress(form.permanent);
    const correspondenceErrors = form.sameAsPermanent
      ? {}
      : validateAddress(form.correspondence);

    if (Object.keys(permanentErrors).length > 0 || Object.keys(correspondenceErrors).length > 0) {
      setErrors({ permanent: permanentErrors, correspondence: correspondenceErrors });
      if (Object.keys(permanentErrors).length > 0) {
        setActiveTab("permanent");
      } else {
        setActiveTab("correspondence");
      }
      return;
    }

    onSubmit({
      ...form,
      correspondence: form.sameAsPermanent ? { ...form.permanent } : form.correspondence,
    });
  };

  const activeValues =
    activeTab === "permanent" ? form.permanent : form.correspondence;
  const activeErrors =
    activeTab === "permanent" ? errors.permanent : errors.correspondence;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {prefilledFromDigilocker ? (
        <p className="rounded-[var(--radius-card)] border border-primary/20 bg-primary/[0.04] px-4 py-3 text-caption text-muted-foreground">
          {copy.kyc.address.digilockerPrefillHint}
        </p>
      ) : null}

      <div className="flex rounded-[var(--radius-full)] border border-border bg-muted/40 p-1">
        {(["permanent", "correspondence"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const isDisabled = tab === "correspondence" && form.sameAsPermanent;

          return (
            <button
              key={tab}
              type="button"
              disabled={isDisabled}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 rounded-[var(--radius-full)] px-3 py-2 text-caption font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background shadow-zynd-low"
                  : "text-muted-foreground hover:text-foreground",
                isDisabled && "cursor-not-allowed opacity-50",
              )}
            >
              {tab === "permanent"
                ? copy.kyc.address.permanentTab
                : copy.kyc.address.correspondenceTab}
            </button>
          );
        })}
      </div>

      <AddressFieldsForm
        prefix={activeTab}
        values={activeValues}
        errors={activeErrors}
        stateOptions={stateOptions}
        disabled={activeTab === "correspondence" && form.sameAsPermanent}
        onChange={(field, value) => updateAddress(activeTab, field, value)}
        onPincodeBlur={(pincode) => void applyPincodeLookup(pincode, activeTab)}
      />

      {activeTab === "permanent" ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border border-border bg-muted/20 px-4 py-3">
          <input
            type="checkbox"
            checked={form.sameAsPermanent}
            onChange={(event) => handleSameAsPermanentChange(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded-[var(--radius-control)] border border-input accent-primary"
          />
          <span className="text-compact leading-relaxed text-foreground">
            {copy.kyc.address.sameAsPermanent}
          </span>
        </label>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? copy.kyc.saving : copy.kyc.continue}
      </Button>
    </form>
  );
}
