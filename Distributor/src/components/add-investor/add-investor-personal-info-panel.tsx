"use client";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ADD_INVESTOR_PERSONAL_OPTIONS,
  normalizeAddInvestorPersonalDraft,
  type AddInvestorPersonalDraft,
} from "@/lib/add-investor/add-investor-journey";
import { cn } from "@/lib/utils";

type AddInvestorPersonalInfoPanelProps = {
  personal: AddInvestorPersonalDraft;
  onPersonalChange: (patch: Partial<AddInvestorPersonalDraft>) => void;
};

function countryOfOriginLabel(value: string): string {
  return (
    ADD_INVESTOR_PERSONAL_OPTIONS.countryOfOrigin.find((option) => option.value === value)?.label ??
    value
  );
}

function personalOptionLabel(
  field: keyof typeof ADD_INVESTOR_PERSONAL_OPTIONS,
  value: string,
): string {
  return (
    ADD_INVESTOR_PERSONAL_OPTIONS[field].find((option) => option.value === value)?.label ?? value
  );
}

export function formatAddInvestorPersonalSummary(personal: AddInvestorPersonalDraft): string {
  const normalized = normalizeAddInvestorPersonalDraft(personal);
  const parts = [
    normalized.fathersName.trim(),
    personalOptionLabel("occupation", normalized.occupation),
    personalOptionLabel("incomeSlab", normalized.incomeSlab),
    `PEP: ${personalOptionLabel("pepExposed", normalized.pepExposed)}`,
    normalized.placeOfBirth.trim(),
  ];

  if (normalized.countryOfOrigin) {
    parts.push(`Origin: ${countryOfOriginLabel(normalized.countryOfOrigin)}`);
  }

  return parts.filter(Boolean).join(" · ");
}

export function formatAddInvestorPersonalReviewItems(
  personal: AddInvestorPersonalDraft,
): Array<{ label: string; value: string }> {
  const normalized = normalizeAddInvestorPersonalDraft(personal);

  return [
    { label: "Father's name", value: normalized.fathersName.trim() },
    {
      label: "Occupation",
      value: personalOptionLabel("occupation", normalized.occupation),
    },
    {
      label: "Income slab",
      value: personalOptionLabel("incomeSlab", normalized.incomeSlab),
    },
    {
      label: "PEP status",
      value: personalOptionLabel("pepExposed", normalized.pepExposed),
    },
    { label: "Place of birth", value: normalized.placeOfBirth.trim() },
    {
      label: "Country of origin",
      value: normalized.countryOfOrigin
        ? countryOfOriginLabel(normalized.countryOfOrigin)
        : "",
    },
  ].filter((item) => item.value.trim());
}

function PersonalSelectField({
  id,
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger id={id} className="add-investor-personal-info-panel__select-trigger">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function AddInvestorPersonalInfoPanel({
  personal,
  onPersonalChange,
}: AddInvestorPersonalInfoPanelProps) {
  return (
    <div className="add-investor-personal-info-panel">
      <FieldGroup className="add-investor-personal-info-panel__fields">
        <Field>
          <FieldLabel htmlFor="add-investor-fathers-name">Father&apos;s name</FieldLabel>
          <Input
            id="add-investor-fathers-name"
            value={personal.fathersName}
            onChange={(event) => onPersonalChange({ fathersName: event.target.value })}
            placeholder="As per official records"
            autoComplete="off"
          />
        </Field>

        <fieldset className="add-investor-personal-info-panel__gender">
          <legend className="add-investor-personal-info-panel__gender-label">Gender</legend>
          <div className="add-investor-personal-info-panel__gender-options" role="radiogroup">
            {ADD_INVESTOR_PERSONAL_OPTIONS.gender.map((option) => {
              const isSelected = personal.gender === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "add-investor-personal-info-panel__gender-option",
                    isSelected && "add-investor-personal-info-panel__gender-option--active",
                  )}
                >
                  <input
                    type="radio"
                    name="add-investor-personal-gender"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => onPersonalChange({ gender: option.value })}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="add-investor-personal-info-panel__row">
          <PersonalSelectField
            id="add-investor-occupation"
            label="Occupation"
            value={personal.occupation}
            placeholder="Select occupation"
            options={ADD_INVESTOR_PERSONAL_OPTIONS.occupation}
            onChange={(value) => onPersonalChange({ occupation: value })}
          />
          <PersonalSelectField
            id="add-investor-income-slab"
            label="Income slab"
            value={personal.incomeSlab}
            placeholder="Select income"
            options={ADD_INVESTOR_PERSONAL_OPTIONS.incomeSlab}
            onChange={(value) => onPersonalChange({ incomeSlab: value })}
          />
        </div>

        <div className="add-investor-personal-info-panel__row">
          <PersonalSelectField
            id="add-investor-marital-status"
            label="Marital status"
            value={personal.maritalStatus}
            placeholder="Select status"
            options={ADD_INVESTOR_PERSONAL_OPTIONS.maritalStatus}
            onChange={(value) => onPersonalChange({ maritalStatus: value })}
          />
          <PersonalSelectField
            id="add-investor-pep"
            label="Politically exposed person (PEP)"
            value={personal.pepExposed}
            placeholder="Select PEP status"
            options={ADD_INVESTOR_PERSONAL_OPTIONS.pepExposed}
            onChange={(value) => onPersonalChange({ pepExposed: value || "no" })}
          />
        </div>

        <div className="add-investor-personal-info-panel__row">
          <Field>
            <FieldLabel htmlFor="add-investor-place-of-birth">Place of birth</FieldLabel>
            <Input
              id="add-investor-place-of-birth"
              value={personal.placeOfBirth}
              onChange={(event) => onPersonalChange({ placeOfBirth: event.target.value })}
              placeholder="City, state / country"
              autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="add-investor-country-of-origin">
              Country of origin <span className="add-investor-personal-info-panel__optional">(optional)</span>
            </FieldLabel>
            <Select
              value={personal.countryOfOrigin}
              onValueChange={(value) => onPersonalChange({ countryOfOrigin: value ?? "" })}
            >
              <SelectTrigger
                id="add-investor-country-of-origin"
                className="add-investor-personal-info-panel__select-trigger"
              >
                <SelectValue placeholder="Select country (optional)" />
              </SelectTrigger>
              <SelectContent>
                {ADD_INVESTOR_PERSONAL_OPTIONS.countryOfOrigin.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FieldGroup>
    </div>
  );
}
