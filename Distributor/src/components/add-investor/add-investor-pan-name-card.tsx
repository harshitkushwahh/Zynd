"use client";

import { CheckCircle2, Loader2, PencilLine, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { AddInvestorPanName, AddInvestorReadiness } from "@/lib/add-investor/add-investor-journey";
import { formatDistributorDate } from "@/lib/format";
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

function PanTypeBadge({ panCategory }: { panCategory: string }) {
  return <span className="add-investor-pan-name-card__badge add-investor-pan-name-card__badge--type">{panCategory}</span>;
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
  disabled,
}: AddInvestorPanNameCardProps) {
  const showPending = !isFetched || !panName;

  if (showPending) {
    return (
      <div className="add-investor-pan-name-card add-investor-pan-name-card--pending">
        <div className="add-investor-pan-name-card__pending-icon" aria-hidden>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <UserRound className="size-4" strokeWidth={2} />
          )}
        </div>
        <div className="add-investor-pan-name-card__pending-body">
          <p className="add-investor-pan-name-card__pending-title">Name from registry</p>
          <p className="add-investor-pan-name-card__pending-desc">
            {isFetching ? "Fetching investor name from Kyckart…" : "Will appear after PAN verification."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="add-investor-pan-name-card add-investor-pan-name-card--fetched">
      <div className="add-investor-pan-name-card__header">
        <div className="add-investor-pan-name-card__header-icon" aria-hidden>
          <CheckCircle2 className="size-4" strokeWidth={2} />
        </div>
        <div className="add-investor-pan-name-card__header-body">
          <p className="add-investor-pan-name-card__header-title">Name from registry</p>
        </div>
      </div>

      <div className="add-investor-pan-name-card__grid add-investor-pan-name-card__grid--names">
        <PanNameField
          label="First name"
          inputId="add-investor-first-name"
          value={panName.firstName}
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
          value={panName.lastName}
          placeholder="Last name"
          onChange={onLastNameChange}
          disabled={disabled || isFetching}
        />
      </div>

      <div className="add-investor-pan-name-card__meta">
        <div className="add-investor-pan-name-card__meta-item">
          <span className="add-investor-pan-name-card__meta-label">Date of birth</span>
          <span className="add-investor-pan-name-card__meta-value">
            {formatDistributorDate(panName.dateOfBirth)}
          </span>
        </div>
        <div className="add-investor-pan-name-card__badge-row">
          <PanTypeBadge panCategory={panName.panCategory} />
          {readiness ? <PanReadinessBadge readiness={readiness} /> : null}
        </div>
      </div>
    </div>
  );
}
