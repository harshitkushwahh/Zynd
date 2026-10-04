"use client";

import { ScanFace } from "lucide-react";

import { AddInvestorPanNameCard } from "@/components/add-investor/add-investor-pan-name-card";
import { Input } from "@/components/ui/input";
import type { AddInvestorPanName, AddInvestorReadiness } from "@/lib/add-investor/add-investor-journey";
import { normalizePanInput } from "@/lib/add-investor/add-investor-demo";

type AddInvestorPanPanelProps = {
  pan: string;
  onPanChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  panVerified: boolean;
  panLoading: boolean;
  panError: string;
  panName: AddInvestorPanName | null;
  readiness: AddInvestorReadiness | null;
  disabled?: boolean;
};

export function AddInvestorPanPanel({
  pan,
  onPanChange,
  onFullNameChange,
  onDateOfBirthChange,
  panVerified,
  panLoading,
  panError,
  panName,
  readiness,
  disabled,
}: AddInvestorPanPanelProps) {
  return (
    <div className="add-investor-onboarding-wizard__center add-investor-pan-panel">
      <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
        <ScanFace className="size-6" strokeWidth={2.25} />
      </span>
      <h3 className="add-investor-onboarding-wizard__title">PAN verification</h3>

      <div className="add-investor-pan-panel__form">
        <Input
          id="add-investor-pan"
          value={pan}
          onChange={(event) => onPanChange(normalizePanInput(event.target.value))}
          placeholder="ABCDE1234F"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled || panLoading || panVerified}
          aria-label="PAN number"
          aria-invalid={Boolean(panError)}
          className="add-investor-pan-panel__input font-mono uppercase"
        />

        <AddInvestorPanNameCard
          isFetched={panVerified}
          isFetching={panLoading}
          panName={panName}
          readiness={readiness}
          onFullNameChange={onFullNameChange}
          onDateOfBirthChange={onDateOfBirthChange}
          disabled={disabled}
        />

        {panError ? <p className="add-investor-pan-panel__error">{panError}</p> : null}
      </div>
    </div>
  );
}
