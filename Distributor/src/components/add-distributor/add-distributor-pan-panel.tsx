"use client";

import { CheckCircle2, Loader2, ScanFace } from "lucide-react";

import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { normalizePanInput } from "@/lib/add-investor/add-investor-demo";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type AddDistributorPanPanelProps = {
  pan: string;
  onPanChange: (value: string) => void;
  panVerified: boolean;
  panLoading: boolean;
  panError: string;
  verifiedName?: string | null;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
  continueDisabled: boolean;
  continueLabel?: string;
};

export function AddDistributorPanPanel({
  pan,
  onPanChange,
  panVerified,
  panLoading,
  panError,
  verifiedName,
  onBack,
  onContinue,
  canBack,
  continueDisabled,
  continueLabel,
}: AddDistributorPanPanelProps) {
  return (
    <AddDistributorWizardPanelShell
      stepId="pan"
      title="Onboarding"
      className="add-investor-wizard-panel--onboarding"
      footer={
        <AddInvestorWizardStepFooter
          onBack={onBack}
          onContinue={onContinue}
          canBack={canBack}
          continueDisabled={continueDisabled}
          continueLabel={
            continueLabel ??
            (panLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Verifying…
              </>
            ) : panVerified ? (
              "Continue"
            ) : (
              "Verify PAN"
            ))
          }
        />
      }
    >
      <div className="add-investor-onboarding-wizard__center add-distributor-pan-panel">
        <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
          <ScanFace className="size-6" strokeWidth={2.25} />
        </span>
        <h3 className="add-investor-onboarding-wizard__title">PAN verification</h3>
        <p className="add-investor-onboarding-wizard__desc">
          {ZYND_MITRA_COPY.panDesc}
        </p>

        <div className="add-distributor-wizard-step-card">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dist-pan">PAN number</FieldLabel>
              <Input
                id="dist-pan"
                value={pan}
                onChange={(event) => onPanChange(normalizePanInput(event.target.value))}
                placeholder="ABCDE1234F"
                autoComplete="off"
                spellCheck={false}
                disabled={panLoading || panVerified}
                aria-invalid={Boolean(panError)}
                className="font-mono uppercase tracking-wide"
              />
            </Field>
            {panError ? (
              <DistributorFeedbackMessage variant="error" className="add-distributor-wizard-feedback">
                {panError}
              </DistributorFeedbackMessage>
            ) : null}
            {panVerified ? (
              <div className="add-distributor-pan-panel__verified">
                <CheckCircle2 className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                <div className="min-w-0 text-left">
                  <p className="add-distributor-pan-panel__verified-title">PAN verified</p>
                  {verifiedName ? (
                    <p className="add-distributor-pan-panel__verified-meta">Registry name: {verifiedName}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </FieldGroup>
        </div>
      </div>
    </AddDistributorWizardPanelShell>
  );
}
