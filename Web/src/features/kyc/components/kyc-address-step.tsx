"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycInfoCallout } from "@/features/kyc/components/kyc-info-callout";
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
import { resolveStateOption } from "@/features/kyc/lib/kyc-digilocker-prefill";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type AddressTab = "permanent" | "correspondence";

type KycAddressStepProps = {
  initialValue?: KycAddressFormValue;
  stateOptions?: string[];
  prefilledFromDigilocker?: boolean;
  digilockerFieldsLocked?: boolean;
  digilockerPrefillIncomplete?: boolean;
  digilockerBlocked?: boolean;
  digilockerFailureReason?: string | null;
  onRetryDigilocker?: () => void;
  retryingDigilocker?: boolean;
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
  lockedFields,
  stateOptions,
  onChange,
  onPincodeBlur,
}: {
  prefix: string;
  values: KycAddressFields;
  errors: Partial<Record<AddressFieldKey, string>>;
  disabled?: boolean;
  lockedFields?: Partial<Record<AddressFieldKey, boolean>>;
  stateOptions: string[];
  onChange: (field: AddressFieldKey, value: string) => void;
  onPincodeBlur?: (pincode: string) => void;
}) {
  const isFieldLocked = (field: AddressFieldKey) => Boolean(disabled || lockedFields?.[field]);
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
                  disabled={isFieldLocked("city")}
                  readOnly={isFieldLocked("city")}
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
                  disabled={isFieldLocked("state")}
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
                  disabled={isFieldLocked("pincode")}
                  readOnly={isFieldLocked("pincode")}
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
              disabled={isFieldLocked(field)}
              readOnly={isFieldLocked(field)}
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
  digilockerFieldsLocked = false,
  digilockerPrefillIncomplete = false,
  digilockerBlocked = false,
  digilockerFailureReason = null,
  onRetryDigilocker,
  retryingDigilocker = false,
  saving = false,
  onSubmit,
}: KycAddressStepProps) {
  const [activeTab, setActiveTab] = useState<AddressTab>("permanent");
  const [form, setForm] = useState<KycAddressFormValue>(() => initialValue ?? createEmptyAddressForm());
  const [errors, setErrors] = useState<{
    permanent: Partial<Record<AddressFieldKey, string>>;
    correspondence: Partial<Record<AddressFieldKey, string>>;
  }>({ permanent: {}, correspondence: {} });
  const pincodeEnrichedRef = useRef(false);

  const digilockerLockedFields: Partial<Record<AddressFieldKey, boolean>> | undefined =
    digilockerFieldsLocked
      ? {
          line1: true,
          city: true,
          state: true,
          pincode: true,
        }
      : undefined;

  useEffect(() => {
    if (!initialValue) return;

    const normalizedPermanent = {
      ...initialValue.permanent,
      state: resolveStateOption(initialValue.permanent.state, stateOptions),
    };
    const normalizedCorrespondence = {
      ...initialValue.correspondence,
      state: resolveStateOption(initialValue.correspondence.state, stateOptions),
    };

    setForm({
      ...initialValue,
      permanent: normalizedPermanent,
      correspondence: normalizedCorrespondence,
    });
  }, [initialValue, stateOptions]);

  const applyPincodeLookup = async (pincode: string, type: "permanent" | "correspondence") => {
    try {
      const result = await fetchKycPincode(pincode);
      setForm((current) => ({
        ...current,
        [type]: {
          ...current[type],
          city: result.city || current[type].city,
          state: resolveStateOption(result.state_name || current[type].state, stateOptions),
          country: DEFAULT_KYC_COUNTRY,
        },
      }));
    } catch {
      // User can still enter city/state manually.
    }
  };

  useEffect(() => {
    if (!prefilledFromDigilocker || pincodeEnrichedRef.current) return;
    const pincode = initialValue?.permanent.pincode ?? "";
    if (pincode.length !== 6) return;

    pincodeEnrichedRef.current = true;
    void applyPincodeLookup(pincode, "permanent");
  }, [initialValue?.permanent.pincode, prefilledFromDigilocker]);

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

    if (digilockerPrefillIncomplete) {
      return;
    }

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

  if (digilockerBlocked) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-dashed border-primary/20 bg-muted/20 px-6 py-8 text-center">
        <p className="max-w-sm text-caption leading-relaxed text-muted-foreground">
          {copy.kyc.digilocker.requiredDescription}
        </p>
        {onRetryDigilocker ? (
          <Button type="button" variant="outline" disabled={retryingDigilocker} onClick={onRetryDigilocker}>
            {copy.kyc.digilocker.failedTitle}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {digilockerPrefillIncomplete ? (
        <div className="space-y-3 rounded-[var(--radius-card)] border border-warning/25 bg-warning/[0.06] px-4 py-3">
          <p className="text-caption leading-relaxed text-foreground">
            {copy.kyc.address.digilockerPrefillIncomplete}
          </p>
          {onRetryDigilocker ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={retryingDigilocker}
              onClick={onRetryDigilocker}
            >
              {retryingDigilocker ? copy.kyc.digilocker.retrying : copy.kyc.digilocker.retry}
            </Button>
          ) : null}
        </div>
      ) : null}

      {prefilledFromDigilocker ? (
        <KycInfoCallout
          title={copy.kyc.address.digilockerPrefillTitle}
          description={copy.kyc.address.digilockerPrefillHint}
        />
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
        lockedFields={activeTab === "permanent" ? digilockerLockedFields : undefined}
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

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={saving || digilockerPrefillIncomplete}
      >
        {saving ? copy.kyc.saving : copy.kyc.continue}
      </Button>
    </form>
  );
}
