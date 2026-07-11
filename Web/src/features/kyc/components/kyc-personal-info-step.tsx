"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycSelectField } from "@/features/kyc/components/kyc-select-field";
import {
  createEmptyPersonalInfo,
  DEFAULT_KYC_NATIONALITY,
  type KycPersonalInfoValue,
} from "@/features/kyc/lib/kyc-personal-info";
import { KYC_PERSONAL_INFO_FALLBACK_OPTIONS } from "@/features/kyc/lib/kyc-master-data-options";
import { validateKycPersonalInfo } from "@/features/kyc/lib/kyc-personal-info-validation";
import {
  KYC_PERSON_NAME_LIMITS,
  KYC_PLACE_OF_BIRTH_LIMITS,
  normalizePersonNameInput,
  normalizePlaceOfBirthInput,
} from "@/features/kyc/lib/kyc-name-validation";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycPersonalInfoStepProps = {
  initialValue?: Partial<KycPersonalInfoValue>;
  enumOptions?: {
    gender: Array<{ label: string; value: string }>;
    incomeSlab: Array<{ label: string; value: string }>;
    occupation: Array<{ label: string; value: string }>;
    maritalStatus: Array<{ label: string; value: string }>;
    pepExposed: Array<{ label: string; value: string }>;
  };
  nationalityOptions?: Array<{ label: string; value: string }>;
  saving?: boolean;
  onSubmit: (value: KycPersonalInfoValue) => void;
};

type PersonalInfoFieldKey = keyof KycPersonalInfoValue;

function GenderRadioGroup({
  value,
  disabled,
  hasError,
  options,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  hasError?: boolean;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-compact font-medium text-foreground">
        {copy.kyc.personalInfo.fields.gender}
      </legend>
      <div
        role="radiogroup"
        aria-invalid={hasError}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => {
          const isSelected = value === option.value;

          return (
            <label
              key={option.value}
              className={cn(
                "inline-flex cursor-pointer items-center rounded-[var(--radius-full)] border px-3 py-1.5 text-caption font-medium transition-colors",
                isSelected
                  ? "border-foreground bg-foreground text-background shadow-zynd-low"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name="kyc-personal-gender"
                value={option.value}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function KycPersonalInfoStep({
  initialValue,
  enumOptions,
  nationalityOptions,
  saving = false,
  onSubmit,
}: KycPersonalInfoStepProps) {
  const [form, setForm] = useState<KycPersonalInfoValue>(() => ({
    ...createEmptyPersonalInfo(),
    ...initialValue,
  }));
  const [errors, setErrors] = useState<Partial<Record<PersonalInfoFieldKey, string>>>({});

  useEffect(() => {
    if (initialValue) {
      setForm((current) => ({ ...current, ...initialValue }));
    }
  }, [initialValue]);

  const genderOptions = enumOptions?.gender ?? KYC_PERSONAL_INFO_FALLBACK_OPTIONS.gender;
  const incomeOptions = enumOptions?.incomeSlab ?? KYC_PERSONAL_INFO_FALLBACK_OPTIONS.incomeSlab;
  const occupationOptions = enumOptions?.occupation ?? KYC_PERSONAL_INFO_FALLBACK_OPTIONS.occupation;
  const maritalOptions = enumOptions?.maritalStatus ?? KYC_PERSONAL_INFO_FALLBACK_OPTIONS.maritalStatus;
  const pepOptions = enumOptions?.pepExposed ?? KYC_PERSONAL_INFO_FALLBACK_OPTIONS.pepExposed;
  const nationalitySelectOptions =
    nationalityOptions ?? [{ label: DEFAULT_KYC_NATIONALITY, value: DEFAULT_KYC_NATIONALITY }];

  const updateField = (field: PersonalInfoFieldKey, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validateKycPersonalInfo(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="kyc-fathers-name">{copy.kyc.personalInfo.fields.fathersName}</Label>
          <Input
            id="kyc-fathers-name"
            value={form.fathersName}
            onChange={(event) =>
              updateField("fathersName", normalizePersonNameInput(event.target.value))
            }
            placeholder={copy.kyc.personalInfo.placeholders.fathersName}
            maxLength={KYC_PERSON_NAME_LIMITS.max}
            aria-invalid={Boolean(errors.fathersName)}
          />
          {errors.fathersName ? <FieldMessage message={errors.fathersName} /> : null}
        </div>

        <div className="space-y-1">
          <GenderRadioGroup
            value={form.gender}
            hasError={Boolean(errors.gender)}
            options={genderOptions}
            onChange={(value) => updateField("gender", value)}
          />
          {errors.gender ? <FieldMessage message={errors.gender} /> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <KycSelectField
              id="kyc-income-slab"
              label={copy.kyc.personalInfo.fields.incomeSlab}
              value={form.incomeSlab}
              options={incomeOptions}
              placeholder={copy.kyc.personalInfo.placeholders.select}
              hasError={Boolean(errors.incomeSlab)}
              onChange={(value) => updateField("incomeSlab", value)}
            />
            {errors.incomeSlab ? <FieldMessage message={errors.incomeSlab} /> : null}
          </div>
          <div className="space-y-2">
            <KycSelectField
              id="kyc-occupation"
              label={copy.kyc.personalInfo.fields.occupation}
              value={form.occupation}
              options={occupationOptions}
              placeholder={copy.kyc.personalInfo.placeholders.select}
              hasError={Boolean(errors.occupation)}
              onChange={(value) => updateField("occupation", value)}
            />
            {errors.occupation ? <FieldMessage message={errors.occupation} /> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <KycSelectField
              id="kyc-marital-status"
              label={copy.kyc.personalInfo.fields.maritalStatus}
              value={form.maritalStatus}
              options={maritalOptions}
              placeholder={copy.kyc.personalInfo.placeholders.select}
              hasError={Boolean(errors.maritalStatus)}
              onChange={(value) => updateField("maritalStatus", value)}
            />
            {errors.maritalStatus ? <FieldMessage message={errors.maritalStatus} /> : null}
          </div>
          <div className="space-y-2">
            <KycSelectField
              id="kyc-pep-exposed"
              label={copy.kyc.personalInfo.fields.pepExposed}
              value={form.pepExposed}
              options={pepOptions}
              placeholder={copy.kyc.personalInfo.placeholders.select}
              hasError={Boolean(errors.pepExposed)}
              onChange={(value) => updateField("pepExposed", value)}
            />
            {errors.pepExposed ? <FieldMessage message={errors.pepExposed} /> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kyc-place-of-birth">{copy.kyc.personalInfo.fields.placeOfBirth}</Label>
            <Input
              id="kyc-place-of-birth"
              value={form.placeOfBirth}
              onChange={(event) =>
                updateField("placeOfBirth", normalizePlaceOfBirthInput(event.target.value))
              }
              placeholder={copy.kyc.personalInfo.placeholders.placeOfBirth}
              maxLength={KYC_PLACE_OF_BIRTH_LIMITS.max}
              aria-invalid={Boolean(errors.placeOfBirth)}
            />
            {errors.placeOfBirth ? <FieldMessage message={errors.placeOfBirth} /> : null}
          </div>
          <div className="space-y-2">
            <KycSelectField
              id="kyc-nationality"
              label={copy.kyc.personalInfo.fields.nationality}
              value={form.nationality}
              options={nationalitySelectOptions}
              placeholder={copy.kyc.personalInfo.placeholders.select}
              hasError={Boolean(errors.nationality)}
              onChange={(value) => updateField("nationality", value)}
            />
            {errors.nationality ? <FieldMessage message={errors.nationality} /> : null}
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? copy.kyc.saving : copy.kyc.phase1CompleteCta}
      </Button>
    </form>
  );
}
