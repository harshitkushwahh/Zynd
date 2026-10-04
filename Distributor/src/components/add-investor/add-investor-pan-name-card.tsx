"use client";

import { Input } from "@/components/ui/input";
import type { AddInvestorPanName, AddInvestorReadiness } from "@/lib/add-investor/add-investor-journey";
import { cn } from "@/lib/utils";

type AddInvestorPanNameCardProps = {
  isFetched: boolean;
  isFetching: boolean;
  panName: AddInvestorPanName | null;
  readiness: AddInvestorReadiness | null;
  onFullNameChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
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

export function AddInvestorPanNameCard({
  isFetched,
  isFetching,
  panName,
  readiness,
  onFullNameChange,
  onDateOfBirthChange,
  disabled,
}: AddInvestorPanNameCardProps) {
  return (
    <div className="space-y-3">
      <div className="add-investor-pan-name-card__grid add-investor-pan-name-card__grid--names">
        <div className="add-investor-pan-name-card__field">
          <label className="add-investor-pan-name-card__field-label" htmlFor="add-investor-full-name">
            Name
          </label>
          <Input
            id="add-investor-full-name"
            value={panName?.fullName ?? ""}
            onChange={(event) => onFullNameChange(event.target.value)}
            placeholder="harshit kushwah"
            autoComplete="name"
            disabled={disabled || isFetching}
            className="add-investor-pan-name-card__field-input"
          />
        </div>
        <div className="add-investor-pan-name-card__field">
          <label className="add-investor-pan-name-card__field-label" htmlFor="add-investor-dob">
            Date of birth
          </label>
          <Input
            id="add-investor-dob"
            type="date"
            value={panName?.dateOfBirth ?? ""}
            onChange={(event) => onDateOfBirthChange(event.target.value)}
            disabled={disabled || isFetching}
            className="add-investor-pan-name-card__field-input"
          />
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
