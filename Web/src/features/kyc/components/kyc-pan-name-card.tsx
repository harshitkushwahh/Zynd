"use client";

import { Input } from "@/components/ui/input";
import { copy } from "@/shared/config/copy";

type KycPanNameCardProps = {
  fullName: string;
  onFullNameChange: (value: string) => void;
  dateOfBirth: string;
  onDateOfBirthChange: (value: string) => void;
  nameInvalid?: boolean;
  dateOfBirthInvalid?: boolean;
  disabled?: boolean;
};

export function KycPanNameCard({
  fullName,
  onFullNameChange,
  dateOfBirth,
  onDateOfBirthChange,
  nameInvalid,
  dateOfBirthInvalid,
  disabled,
}: KycPanNameCardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="kyc-pan-full-name" className="text-caption font-medium text-muted-foreground">
          {copy.kyc.pan.fullNameLabel}
        </label>
        <Input
          id="kyc-pan-full-name"
          value={fullName}
          onChange={(event) => onFullNameChange(event.target.value)}
          placeholder={copy.kyc.pan.fullNamePlaceholder}
          autoComplete="name"
          disabled={disabled}
          aria-invalid={nameInvalid}
        />
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
        />
      </div>
    </div>
  );
}
