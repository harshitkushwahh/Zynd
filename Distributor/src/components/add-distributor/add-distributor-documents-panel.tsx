"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";

import { AddDistributorDocumentUpload } from "@/components/add-distributor/add-distributor-document-upload";
import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import type { AddDistributorDocumentDraft } from "@/lib/add-distributor/add-distributor-journey";
import {
  clearPartnerOnboardingDocument,
  uploadPartnerOnboardingDocument,
} from "@/lib/distributor-partners-api";
import { ApiError } from "@/lib/api-client";

type AddDistributorDocumentsPanelProps = {
  onboardingToken: string | null;
  documents: AddDistributorDocumentDraft;
  onDocumentsChange: (patch: Partial<AddDistributorDocumentDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
  continueDisabled: boolean;
};

function revokePreviewUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function AddDistributorDocumentsPanel({
  onboardingToken,
  documents,
  onDocumentsChange,
  onBack,
  onContinue,
  canBack,
  continueDisabled,
}: AddDistributorDocumentsPanelProps) {
  const [uploadingType, setUploadingType] = useState<"pan" | "aadhaar" | null>(null);
  const [error, setError] = useState("");

  const uploadDocument = async (docType: "pan" | "aadhaar", file: File) => {
    if (!onboardingToken || uploadingType) return;
    setError("");
    setUploadingType(docType);

    const previewUrl = URL.createObjectURL(file);
    if (docType === "pan") {
      revokePreviewUrl(documents.panPreviewUrl);
    } else {
      revokePreviewUrl(documents.aadhaarPreviewUrl);
    }

    try {
      const result = await uploadPartnerOnboardingDocument(onboardingToken, docType, file);
      if (docType === "pan") {
        onDocumentsChange({ panFileName: result.file_name, panPreviewUrl: previewUrl });
      } else {
        onDocumentsChange({ aadharFileName: result.file_name, aadhaarPreviewUrl: previewUrl });
      }
    } catch (nextError) {
      revokePreviewUrl(previewUrl);
      setError(nextError instanceof ApiError ? nextError.message : "Could not upload document.");
    } finally {
      setUploadingType(null);
    }
  };

  const clearDocument = async (docType: "pan" | "aadhaar") => {
    if (docType === "pan") {
      revokePreviewUrl(documents.panPreviewUrl);
    } else {
      revokePreviewUrl(documents.aadhaarPreviewUrl);
    }

    if (!onboardingToken) {
      onDocumentsChange(
        docType === "pan"
          ? { panFileName: null, panPreviewUrl: null }
          : { aadharFileName: null, aadhaarPreviewUrl: null },
      );
      return;
    }
    setError("");
    try {
      await clearPartnerOnboardingDocument(onboardingToken, docType);
      onDocumentsChange(
        docType === "pan"
          ? { panFileName: null, panPreviewUrl: null }
          : { aadharFileName: null, aadhaarPreviewUrl: null },
      );
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Could not remove document.");
    }
  };

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
          continueDisabled={continueDisabled || Boolean(uploadingType)}
        />
      }
    >
      <div className="add-investor-onboarding-wizard__center add-distributor-documents-panel">
        <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
          <FileUp className="size-6" strokeWidth={2.25} />
        </span>
        <h3 className="add-investor-onboarding-wizard__title">KYC documents</h3>
        <p className="add-investor-onboarding-wizard__desc">
          Upload clear scans or PDFs for HO compliance review before ARN activation.
        </p>

        <div className="add-distributor-wizard-step-card add-distributor-documents-panel__card">
          <div className="add-distributor-documents-panel__col">
            <AddDistributorDocumentUpload
              id="dist-doc-pan"
              variant="wizard"
              label="PAN card"
              description="Permanent Account Number proof"
              fileName={documents.panFileName}
              previewUrl={documents.panPreviewUrl}
              uploading={uploadingType === "pan"}
              onFileSelect={(file) => uploadDocument("pan", file)}
              onClear={() => clearDocument("pan")}
            />
          </div>
          <div className="add-distributor-documents-panel__col">
            <AddDistributorDocumentUpload
              id="dist-doc-aadhar"
              variant="wizard"
              label="Aadhaar card"
              description="Identity & address verification"
              fileName={documents.aadharFileName}
              previewUrl={documents.aadhaarPreviewUrl}
              uploading={uploadingType === "aadhaar"}
              onFileSelect={(file) => uploadDocument("aadhaar", file)}
              onClear={() => clearDocument("aadhaar")}
            />
          </div>
        </div>
        {error ? (
          <DistributorFeedbackMessage
            variant="error"
            className="add-distributor-wizard-feedback"
            onDismiss={() => setError("")}
          >
            {error}
          </DistributorFeedbackMessage>
        ) : null}
      </div>
    </AddDistributorWizardPanelShell>
  );
}
