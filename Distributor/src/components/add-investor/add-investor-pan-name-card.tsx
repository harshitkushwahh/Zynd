"use client";

import { CheckCircle2, PencilLine } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { AddInvestorPanName, AddInvestorReadiness } from "@/lib/add-investor/add-investor-journey";
import { cn } from "@/lib/utils";

type AddInvestorPanNameCardProps = {
  isFetched: boolean;
  isFetching: boolean;
  panName: AddInvestorPanName | null;
  readiness: AddInvestorReadiness | null;
  middleName: string;
  onFirstNameChange: (value: string) => void;
  onMiddleNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  onPanCategoryChange: (value: "individual" | "corporate") => void;
  disabled?: boolean;
};

function PanReadinessBadge({ readiness }: { readiness: AddInvestorReadiness }) {
  const isKra = readiness.code === "kyc_registered";
  return (
    <span
      className={cn(
        "add-investor-pan-name-card__badge",
        isKra ? "add-investor-pan-name-card__badge--kra" : "add-investor-pan-name-card__badge--new",
      )}
    >
      {isKra ? "KRA compliant" : readiness.label}
    </span>
  );
}

type PanNameFieldProps = {
  label: string;
  inputId: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function PanNameField({
  label,
  inputId,
  value,
  placeholder,
  onChange,
  disabled,
}: PanNameFieldProps) {
  return (
    <div className="add-investor-pan-name-card__field">
      <label className="add-investor-pan-name-card__field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="add-investor-pan-name-card__field-input-wrap">
        <Input
          id={inputId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="additional-name"
          disabled={disabled}
          className="add-investor-pan-name-card__field-input"
        />
        <PencilLine className="add-investor-pan-name-card__field-edit" strokeWidth={2} aria-hidden />
      </div>
    </div>
  );
}

export function AddInvestorPanNameCard({
  isFetched,
  isFetching,
  panName,
  readiness,
  middleName,
  onFirstNameChange,
  onMiddleNameChange,
  onLastNameChange,
  onDateOfBirthChange,
  onPanCategoryChange,
  disabled,
}: AddInvestorPanNameCardProps) {
  const names = panName ?? {
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    panCategory: "individual",
  };

  return (
    <div className="add-investor-pan-name-card add-investor-pan-name-card--fetched">
      <div className="add-investor-pan-name-card__header">
        <div className="add-investor-pan-name-card__header-icon" aria-hidden>
          <CheckCircle2 className="size-4" strokeWidth={2} />
        </div>
        <div className="add-investor-pan-name-card__header-body">
          <p className="add-investor-pan-name-card__header-title">Name as on PAN</p>
        </div>
      </div>

      <div className="add-investor-pan-name-card__grid add-investor-pan-name-card__grid--names">
        <PanNameField
          label="First name"
          inputId="add-investor-first-name"
          value={names.firstName}
          placeholder="First name"
          onChange={onFirstNameChange}
          disabled={disabled || isFetching}
        />
        <PanNameField
          label="Middle name"
          inputId="add-investor-middle-name"
          value={middleName}
          placeholder="Optional"
          onChange={onMiddleNameChange}
          disabled={disabled || isFetching}
        />
        <PanNameField
          label="Last name"
          inputId="add-investor-last-name"
          value={names.lastName}
          placeholder="Last name"
          onChange={onLastNameChange}
          disabled={disabled || isFetching}
        />
      </div>

      <div className="add-investor-pan-name-card__grid add-investor-pan-name-card__grid--names">
        <div className="add-investor-pan-name-card__field">
          <label className="add-investor-pan-name-card__field-label" htmlFor="add-investor-dob">
            Date of birth
          </label>
          <Input
            id="add-investor-dob"
            type="date"
            value={names.dateOfBirth}
            onChange={(event) => onDateOfBirthChange(event.target.value)}
            disabled={disabled || isFetching}
            className="add-investor-pan-name-card__field-input"
          />
        </div>
        <div className="add-investor-pan-name-card__field">
          <label className="add-investor-pan-name-card__field-label" htmlFor="add-investor-pan-category">
            PAN type
          </label>
          <select
            id="add-investor-pan-category"
            value={names.panCategory === "corporate" ? "corporate" : "individual"}
            onChange={(event) =>
              onPanCategoryChange(event.target.value === "corporate" ? "corporate" : "individual")
            }
            disabled={disabled || isFetching}
            className="add-investor-pan-name-card__field-input"
          >
            <option value="individual">Individual</option>
            <option value="corporate">Corporate</option>
          </select>
        </div>
      </div>

      {isFetched && readiness ? (
        <div className="add-investor-pan-name-card__badge-row">
          <PanReadinessBadge readiness={readiness} />
        </div>
      ) : null}
    </div>
  );
}
