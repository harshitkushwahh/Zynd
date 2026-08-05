"use client";

import { ScanFace } from "lucide-react";

import { AddInvestorPanNameCard } from "@/components/add-investor/add-investor-pan-name-card";
import { Input } from "@/components/ui/input";
import type { AddInvestorPanName, AddInvestorReadiness } from "@/lib/add-investor/add-investor-journey";
import { normalizePanInput, ADD_INVESTOR_DEMO_PAN_DIGILOCKER, ADD_INVESTOR_DEMO_PAN_KRA } from "@/lib/add-investor/add-investor-demo";

type AddInvestorPanPanelProps = {
  pan: string;
  onPanChange: (value: string) => void;
  middleName: string;
  onMiddleNameChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
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
  middleName,
  onMiddleNameChange,
  onFirstNameChange,
  onLastNameChange,
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
        <AddInvestorPanNameCard
          isFetched={panVerified}
          isFetching={panLoading}
          panName={panName}
          readiness={readiness}
          middleName={middleName}
          onMiddleNameChange={onMiddleNameChange}
          onFirstNameChange={onFirstNameChange}
          onLastNameChange={onLastNameChange}
          disabled={disabled}
        />

        <Input
          id="add-investor-pan"
          value={pan}
          onChange={(event) => onPanChange(normalizePanInput(event.target.value))}
          placeholder={ADD_INVESTOR_DEMO_PAN_KRA}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled || panLoading || panVerified}
          aria-label="PAN number"
          aria-invalid={Boolean(panError)}
          className="add-investor-pan-panel__input font-mono uppercase"
        />

        <p className="add-investor-pan-panel__demo-hint">
          Demo: <span className="font-mono">{ADD_INVESTOR_DEMO_PAN_KRA}</span> KRA registered ·{" "}
          <span className="font-mono">{ADD_INVESTOR_DEMO_PAN_DIGILOCKER}</span> DigiLocker path
        </p>

        {panError ? <p className="add-investor-pan-panel__error">{panError}</p> : null}
      </div>
    </div>
  );
}
