"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Upload } from "lucide-react";

import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { DistributorProfileAvatar } from "@/components/ui/distributor-profile-avatar";
import { Button } from "@/components/ui/button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import {
  prepareProfileImageFile,
  PROFILE_IMAGE_ACCEPT,
} from "@/lib/add-distributor/add-distributor-profile-image";
import { uploadPartnerOnboardingProfilePhoto, clearPartnerOnboardingProfilePhoto } from "@/lib/distributor-partners-api";
import { ApiError } from "@/lib/api-client";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type AddDistributorProfilePhotoPanelProps = {
  onboardingToken: string | null;
  displayName: string;
  fileName: string | null;
  previewUrl: string | null;
  uploaded: boolean;
  onUploaded: (payload: { fileName: string; previewUrl: string }) => void;
  onClear: () => void | Promise<void>;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
  continueDisabled: boolean;
};

export function AddDistributorProfilePhotoPanel({
  onboardingToken,
  displayName,
  fileName,
  previewUrl,
  uploaded,
  onUploaded,
  onClear,
  onBack,
  onContinue,
  canBack,
  continueDisabled,
}: AddDistributorProfilePhotoPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (file: File | undefined) => {
    if (!file || uploading) return;
    if (!onboardingToken) {
      setError("Onboarding session expired. Start again from email verification.");
      return;
    }

    setError("");
    const prepared = await prepareProfileImageFile(file);
    if (!prepared.ok) {
      setError(prepared.message);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadPartnerOnboardingProfilePhoto(onboardingToken, prepared.file);
      const nextPreviewUrl = URL.createObjectURL(prepared.file);
      onUploaded({ fileName: result.file_name, previewUrl: nextPreviewUrl });
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Could not upload profile photo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <AddDistributorWizardPanelShell
      stepId="photo"
      title="Onboarding"
      className="add-investor-wizard-panel--onboarding"
      footer={
        <AddInvestorWizardStepFooter
          onBack={onBack}
          onContinue={onContinue}
          canBack={canBack}
          continueDisabled={continueDisabled || uploading}
          continueLabel={
            uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              "Continue"
            )
          }
        />
      }
    >
      <div className="add-investor-onboarding-wizard__center add-distributor-profile-photo-panel">
        <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
          <Camera className="size-6" strokeWidth={2.25} />
        </span>
        <h3 className="add-investor-onboarding-wizard__title">Profile photo</h3>
        <p className="add-investor-onboarding-wizard__desc">
          Add a clear headshot for the {ZYND_MITRA_COPY.singular} profile.
        </p>

        <div className="add-distributor-wizard-step-card add-distributor-profile-photo-panel__card">
          <DistributorProfileAvatar
            name={displayName}
            imageSrc={previewUrl}
            size="lg"
            className="add-distributor-profile-photo-panel__avatar mx-auto size-24 text-title"
          />

          <input
            ref={inputRef}
            id="add-distributor-profile-photo"
            type="file"
            accept={PROFILE_IMAGE_ACCEPT}
            className="sr-only"
            onChange={(event) => void handleFileChange(event.target.files?.[0])}
          />

          <div className="add-distributor-profile-photo-panel__actions">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="size-4" aria-hidden />
                  {uploaded ? "Replace photo" : "Upload photo"}
                </>
              )}
            </Button>
            {uploaded ? (
              <Button
                type="button"
                variant="ghost"
                disabled={uploading}
                onClick={() => {
                  void (async () => {
                    setError("");
                    if (onboardingToken) {
                      try {
                        await clearPartnerOnboardingProfilePhoto(onboardingToken);
                      } catch (nextError) {
                        setError(
                          nextError instanceof ApiError
                            ? nextError.message
                            : "Could not remove profile photo.",
                        );
                        return;
                      }
                    }
                    onClear();
                    if (inputRef.current) inputRef.current.value = "";
                  })();
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>

          {fileName ? (
            <p className="add-distributor-doc__file-name text-center">{fileName}</p>
          ) : null}
          <p className="add-distributor-doc__hint text-center">
            JPG, PNG, or WEBP · at least 128×128 · max 4 MB
          </p>
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
      </div>
    </AddDistributorWizardPanelShell>
  );
}
