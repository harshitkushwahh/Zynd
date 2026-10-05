"use client";

import { Input } from "@/components/ui/input";
import { copy } from "@/shared/config/copy";

type KycPanNameCardProps = {
  firstName: string;
  middleName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onMiddleNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  dateOfBirth: string;
  onDateOfBirthChange: (value: string) => void;
  firstNameInvalid?: boolean;
  middleNameInvalid?: boolean;
  lastNameInvalid?: boolean;
  dateOfBirthInvalid?: boolean;
  disabled?: boolean;
};

export function KycPanNameCard({
  firstName,
  middleName,
  lastName,
  onFirstNameChange,
  onMiddleNameChange,
  onLastNameChange,
  dateOfBirth,
  onDateOfBirthChange,
  firstNameInvalid,
  middleNameInvalid,
  lastNameInvalid,
  dateOfBirthInvalid,
  disabled,
}: KycPanNameCardProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="kyc-pan-first-name" className="text-caption font-medium text-muted-foreground">
            {copy.kyc.pan.firstNameLabel}
          </label>
          <Input
            id="kyc-pan-first-name"
            value={firstName}
            onChange={(event) => onFirstNameChange(event.target.value)}
            placeholder={copy.kyc.pan.firstNamePlaceholder}
            autoComplete="given-name"
            disabled={disabled}
            aria-invalid={firstNameInvalid}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="kyc-pan-middle-name" className="text-caption font-medium text-muted-foreground">
            {copy.kyc.pan.middleNameLabel}
          </label>
          <Input
            id="kyc-pan-middle-name"
            value={middleName}
            onChange={(event) => onMiddleNameChange(event.target.value)}
            placeholder={copy.kyc.pan.middleNamePlaceholder}
            autoComplete="additional-name"
            disabled={disabled}
            aria-invalid={middleNameInvalid}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="kyc-pan-last-name" className="text-caption font-medium text-muted-foreground">
            {copy.kyc.pan.lastNameLabel}
          </label>
          <Input
            id="kyc-pan-last-name"
            value={lastName}
            onChange={(event) => onLastNameChange(event.target.value)}
            placeholder={copy.kyc.pan.lastNamePlaceholder}
            autoComplete="family-name"
            disabled={disabled}
            aria-invalid={lastNameInvalid}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="kyc-pan-dob" className="text-caption font-medium text-muted-foreground">
          {copy.kyc.pan.dateOfBirthLabel}
        </label>
        <Input
          id="kyc-pan-dob"
          type="date"
          value={dateOfBirth}
          onChange={(event) => onDateOfBirthChange(event.target.value)}
          disabled={disabled}
          aria-invalid={dateOfBirthInvalid}
          className="w-full"
        />
      </div>
    </div>
  );
}
