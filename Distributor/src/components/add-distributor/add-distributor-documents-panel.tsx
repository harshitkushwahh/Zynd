"use client";

import { FileUp } from "lucide-react";

import { AddDistributorDocumentUpload } from "@/components/add-distributor/add-distributor-document-upload";
import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import type { AddDistributorDocumentDraft } from "@/lib/add-distributor/add-distributor-journey";

type AddDistributorDocumentsPanelProps = {
  documents: AddDistributorDocumentDraft;
  onDocumentsChange: (patch: Partial<AddDistributorDocumentDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
  continueDisabled: boolean;
};

export function AddDistributorDocumentsPanel({
  documents,
  onDocumentsChange,
  onBack,
  onContinue,
  canBack,
  continueDisabled,
}: AddDistributorDocumentsPanelProps) {
  return (
    <AddDistributorWizardPanelShell
      stepId="documents"
      title="Onboarding"
      className="add-investor-wizard-panel--onboarding"
      footer={
        <AddInvestorWizardStepFooter
          onBack={onBack}
          onContinue={onContinue}
          canBack={canBack}
          continueDisabled={continueDisabled}
        />
      }
    >
      <div className="add-investor-onboarding-wizard__center add-distributor-documents-panel">
        <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
          <FileUp className="size-6" strokeWidth={2.25} />
        </span>
        <h3 className="add-investor-onboarding-wizard__title">KYC documents</h3>
        <p className="add-investor-onboarding-wizard__desc">
          Upload clear scans or PDFs for compliance review before ARN activation.
        </p>

        <div className="add-distributor-wizard-step-card add-distributor-documents-panel__card">
          <div className="add-distributor-documents-panel__col">
            <AddDistributorDocumentUpload
              id="dist-doc-pan"
              variant="wizard"
              label="PAN card"
              description="Permanent Account Number proof"
              fileName={documents.panFileName}
              onFileSelect={(panFileName) => onDocumentsChange({ panFileName })}
            />
          </div>
          <div className="add-distributor-documents-panel__col">
            <AddDistributorDocumentUpload
              id="dist-doc-aadhar"
              variant="wizard"
              label="Aadhaar card"
              description="Identity & address verification"
              fileName={documents.aadharFileName}
              onFileSelect={(aadharFileName) => onDocumentsChange({ aadharFileName })}
            />
          </div>
        </div>
      </div>
    </AddDistributorWizardPanelShell>
  );
}
