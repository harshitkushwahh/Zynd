"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycDigilockerInfoCard } from "@/features/kyc/components/kyc-digilocker-info-card";
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
import {
  addressHadValues,
  addressMatchesPincode,
  applyPincodeToAddress,
} from "@/features/kyc/lib/kyc-pincode";
import { ApiError } from "@/lib/api-client";
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
  const [pincodeNotice, setPincodeNotice] = useState<{
    permanent: string;
    correspondence: string;
  }>({ permanent: "", correspondence: "" });
  const pincodeEnrichedRef = useRef<{ permanent?: string; correspondence?: string }>({});
  const lookupRequestRef = useRef(0);
  const formRef = useRef(form);
  formRef.current = form;

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
    if (pincode.length !== 6) return "skipped" as const;

    const requestId = ++lookupRequestRef.current;
    try {
      const result = await fetchKycPincode(pincode);
      if (requestId !== lookupRequestRef.current) return "skipped" as const;

      const current = formRef.current;
      const currentAddress = current[type];
      const match = addressMatchesPincode(currentAddress, result, stateOptions);
      const nextAddress = applyPincodeToAddress(currentAddress, result, stateOptions);
      const hadMismatch = addressHadValues(currentAddress) && !match.matched;
      const nextForm = {
        ...current,
        [type]: nextAddress,
        correspondence:
          current.sameAsPermanent && type === "permanent" ? { ...nextAddress } : current.correspondence,
      };

      formRef.current = nextForm;
      pincodeEnrichedRef.current[type] = pincode;
      setForm(nextForm);

      if (hadMismatch && (match.expectedCity || match.expectedState)) {
        setPincodeNotice((notices) => ({
          ...notices,
          [type]: copy.kyc.address.pincodeMismatchDescription(
            nextAddress.city || match.expectedCity,
            nextAddress.state || match.expectedState,
          ),
        }));
        return "corrected" as const;
      }

      setPincodeNotice((notices) => ({ ...notices, [type]: "" }));
      return "matched" as const;
    } catch (error) {
      if (requestId !== lookupRequestRef.current) return "skipped" as const;
      const notFound = error instanceof ApiError && (error.status === 404 || error.code === "invalid_pincode");
      if (notFound) {
        setErrors((current) => ({
          ...current,
          [type]: {
            ...current[type],
            pincode: copy.kyc.address.pincodeNotFound,
          },
        }));
        return "invalid" as const;
      }
      return "failed" as const;
    }
  };

  useEffect(() => {
    const pincode = initialValue?.permanent.pincode ?? "";
    if (pincode.length !== 6) return;
    if (pincodeEnrichedRef.current.permanent === pincode) return;

    void applyPincodeLookup(pincode, "permanent");
  }, [initialValue?.permanent.pincode, prefilledFromDigilocker, stateOptions]);

  const updateAddress = (
    type: "permanent" | "correspondence",
    field: AddressFieldKey,
    value: string
  ) => {
    setForm((current) => {
      const next = {
        ...current,
        [type]: {
          ...current[type],
          [field]: value,
          country: DEFAULT_KYC_COUNTRY,
        },
      };
      if (current.sameAsPermanent && type === "permanent") {
        next.correspondence = { ...next.permanent };
      }
      formRef.current = next;
      return next;
    });
    setErrors((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [field]: undefined,
      },
    }));
    if (field === "pincode") {
      setPincodeNotice((notices) => ({ ...notices, [type]: "" }));
      pincodeEnrichedRef.current[type] = undefined;
      if (value.length === 6) {
        void applyPincodeLookup(value, type);
      }
    }
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

  const handleSubmit = async (event: React.FormEvent) => {
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

    const permanentLookup = await applyPincodeLookup(formRef.current.permanent.pincode, "permanent");
    if (permanentLookup === "invalid") {
      setActiveTab("permanent");
      return;
    }
    if (permanentLookup === "corrected") {
      setActiveTab("permanent");
      return;
    }

    if (!formRef.current.sameAsPermanent) {
      const correspondenceLookup = await applyPincodeLookup(
        formRef.current.correspondence.pincode,
        "correspondence",
      );
      if (correspondenceLookup === "invalid" || correspondenceLookup === "corrected") {
        setActiveTab("correspondence");
        return;
      }
    }

    const latest = formRef.current;
    onSubmit({
      ...latest,
      correspondence: latest.sameAsPermanent ? { ...latest.permanent } : latest.correspondence,
    });
  };

  const activeValues =
    activeTab === "permanent" ? form.permanent : form.correspondence;
  const activeErrors =
    activeTab === "permanent" ? errors.permanent : errors.correspondence;

  if (digilockerBlocked) {
    return (
      <div className="mt-3 w-full">
        <KycDigilockerInfoCard
          variant="required"
          layout="prominent"
          className="mx-auto w-full max-w-lg"
          onRetry={onRetryDigilocker}
          retrying={retryingDigilocker}
        />
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
          action={
            onRetryDigilocker ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-[var(--radius-control)] border-info/20 bg-background/80"
                disabled={retryingDigilocker}
                aria-label={copy.kyc.digilocker.retry}
                title={copy.kyc.digilocker.retry}
                onClick={onRetryDigilocker}
              >
                <RefreshCw
                  className={cn("size-4", retryingDigilocker && "animate-spin")}
                  aria-hidden
                />
              </Button>
            ) : undefined
          }
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

      {pincodeNotice[activeTab] ? (
        <div
          role="status"
          className="rounded-[var(--radius-card)] border border-warning/25 bg-warning/[0.06] px-4 py-3"
        >
          <p className="text-caption font-semibold text-foreground">
            {copy.kyc.address.pincodeMismatchTitle}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {pincodeNotice[activeTab]}
          </p>
        </div>
      ) : null}

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
