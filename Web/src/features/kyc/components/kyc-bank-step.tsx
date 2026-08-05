"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycBankAccountCard } from "@/features/kyc/components/kyc-bank-account-card";
import { KycSelectField } from "@/features/kyc/components/kyc-select-field";
import {
  uploadKycBankProof,
  verifyKycBankHybrid,
  verifyKycBankManual,
  fetchKycBankPreverifyStatus,
} from "@/features/kyc/lib/kyc-api";
import { pollWithBackoff } from "@/features/kyc/lib/kyc-polling";
import {
  createEmptyBankForm,
  KYC_BANK_ACCOUNT_TYPE_OPTIONS,
  normalizeAccountNumber,
  normalizeIfscCode,
  type KycBankAccountDetails,
  type KycBankFormValue,
  type KycBankVerificationResult,
  validateKycBankForm,
} from "@/features/kyc/lib/kyc-bank";
import type { KycReadinessInfo } from "@/features/kyc/lib/kyc-pan-readiness";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycBankStepProps = {
  initialValue?: KycBankFormValue;
  initialAccountDetails?: KycBankAccountDetails | null;
  initialVerification?: KycBankVerificationResult | null;
  initialProofUploaded?: boolean;
  readiness?: KycReadinessInfo | null;
  saving?: boolean;
  onSubmit: (value: KycBankFormValue & { accountDetails: KycBankAccountDetails }) => void;
};

export function KycBankStep({
  initialValue,
  initialAccountDetails,
  initialVerification,
  initialProofUploaded = false,
  readiness,
  saving = false,
  onSubmit,
}: KycBankStepProps) {
  const [form, setForm] = useState<KycBankFormValue>(() => initialValue ?? createEmptyBankForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof KycBankFormValue, string>>>({});
  const [processError, setProcessError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(
    Boolean(initialVerification?.bankVerified && initialAccountDetails),
  );
  const [accountDetails, setAccountDetails] = useState<KycBankAccountDetails | null>(
    initialAccountDetails ?? null,
  );
  const [verification, setVerification] = useState<KycBankVerificationResult | null>(
    initialVerification ?? null,
  );
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(initialProofUploaded);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetVerificationState = () => {
    setIsComplete(false);
    setAccountDetails(null);
    setVerification(null);
    setProcessError("");
    setProofFile(null);
    setProofUploaded(false);
  };

  const handleEditBankDetails = () => {
    resetVerificationState();
  };

  const updateField = (field: keyof KycBankFormValue, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    resetVerificationState();
  };

  const validateForm = () => validateKycBankForm(form);

  const runHybridVerification = async () => {
    const result = await verifyKycBankHybrid({
      account_number: form.accountNumber,
      account_type: form.accountType,
      ifsc_code: form.ifscCode,
    });

    const verificationResult: KycBankVerificationResult = {
      panVerified: result.pan_verified,
      bankVerified: result.bank_verified,
      readinessVerified: result.readiness_verified,
      bankName: result.bank_name ?? "",
      branch: result.branch ?? "",
      requiresManualVerification: result.requires_manual_verification,
      requiresProofUpload: result.requires_proof_upload,
      preverifyId: result.preverify_id,
      failureReason: result.failure?.reason,
    };

    if (!result.account_holder_name) {
      throw new Error(copy.kyc.bank.fetchFailed);
    }

    setAccountDetails({
      accountHolderName: result.account_holder_name,
      bankName: verificationResult.bankName,
      branch: verificationResult.branch,
    });
    setVerification(verificationResult);

    if (result.bank_verified) {
      setIsComplete(true);
      return;
    }

    if (
      result.preverify_id &&
      !result.requires_manual_verification &&
      !result.requires_proof_upload
    ) {
      const polled = await pollWithBackoff(
        () => fetchKycBankPreverifyStatus(result.preverify_id!),
        (status) => !status.bank_verified,
        { maxAttempts: 8, baseDelayMs: 1000 },
      );
      if (polled.bank_verified) {
        setVerification((current) =>
          current ? { ...current, bankVerified: true, readinessVerified: true } : current,
        );
        setIsComplete(true);
        return;
      }
    }

    if (result.requires_manual_verification) {
      setIsComplete(false);
      return;
    }

    throw new Error(result.failure?.reason ?? copy.kyc.bank.verifyFailed);
  };

  const handleManualVerify = async () => {
    if (!proofUploaded) {
      setProcessError(copy.kyc.bank.proofRequired);
      return;
    }

    setIsProcessing(true);
    setProcessError("");
    try {
      const result = await verifyKycBankManual();
      if (!result.success || !result.bank_verified) {
        throw new Error(result.failure?.reason ?? copy.kyc.bank.verifyFailed);
      }
      setVerification((current) =>
        current
          ? { ...current, bankVerified: true, readinessVerified: true, requiresManualVerification: false }
          : current,
      );
      setIsComplete(true);
    } catch (error) {
      setProcessError(error instanceof Error ? error.message : copy.kyc.bank.verifyFailed);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProofUpload = async (file: File) => {
    setProofUploading(true);
    setProcessError("");
    try {
      await uploadKycBankProof(file);
      setProofFile(file);
      setProofUploaded(true);
    } catch (error) {
      setProcessError(error instanceof Error ? error.message : copy.kyc.bank.proofUploadFailed);
    } finally {
      setProofUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (verification?.requiresManualVerification && !isComplete) {
      await handleManualVerify();
      return;
    }

    if (!isComplete || !accountDetails) {
      setIsProcessing(true);
      setProcessError("");
      try {
        await runHybridVerification();
      } catch (error) {
        setProcessError(error instanceof Error ? error.message : copy.kyc.bank.verifyFailed);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    onSubmit({
      ...form,
      accountDetails,
    });
  };

  const showManualProof = Boolean(verification?.requiresManualVerification && !isComplete);
  const buttonLabel = isProcessing
    ? copy.kyc.bank.verifying
    : showManualProof
      ? copy.kyc.bank.verifyManual
      : isComplete
        ? copy.kyc.continue
        : copy.kyc.bank.verify;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <KycBankAccountCard
          isProcessing={isProcessing}
          isComplete={isComplete}
          accountDetails={accountDetails}
          verification={verification}
          readiness={readiness}
          onEdit={handleEditBankDetails}
        />

        <div className="space-y-2">
          <Label htmlFor="kyc-bank-account-number">{copy.kyc.bank.fields.accountNumber}</Label>
          <Input
            id="kyc-bank-account-number"
            inputMode="numeric"
            value={form.accountNumber}
            onChange={(event) => updateField("accountNumber", normalizeAccountNumber(event.target.value))}
            placeholder={copy.kyc.bank.placeholders.accountNumber}
            disabled={isProcessing || isComplete || saving}
            aria-invalid={Boolean(formErrors.accountNumber)}
          />
          {formErrors.accountNumber ? <FieldMessage message={formErrors.accountNumber} /> : null}
        </div>

        <KycSelectField
          id="kyc-bank-account-type"
          label={copy.kyc.bank.fields.accountType}
          value={form.accountType}
          options={KYC_BANK_ACCOUNT_TYPE_OPTIONS}
          placeholder={copy.kyc.bank.placeholders.select}
          disabled={isProcessing || isComplete || saving}
          hasError={Boolean(formErrors.accountType)}
          onChange={(value) => updateField("accountType", value)}
        />
        {formErrors.accountType ? <FieldMessage message={formErrors.accountType} /> : null}

        <div className="space-y-2">
          <Label htmlFor="kyc-bank-ifsc">{copy.kyc.bank.fields.ifscCode}</Label>
          <Input
            id="kyc-bank-ifsc"
            value={form.ifscCode}
            onChange={(event) => updateField("ifscCode", normalizeIfscCode(event.target.value))}
            placeholder={copy.kyc.bank.placeholders.ifscCode}
            autoComplete="off"
            spellCheck={false}
            disabled={isProcessing || isComplete || saving}
            aria-invalid={Boolean(formErrors.ifscCode)}
            className="font-mono uppercase tracking-wide"
          />
          {formErrors.ifscCode ? <FieldMessage message={formErrors.ifscCode} /> : null}
        </div>

        {showManualProof ? (
          <div className="space-y-3 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 p-4">
            <p className="text-caption font-medium text-foreground">{copy.kyc.bank.manualVerifyTitle}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {verification?.failureReason ?? copy.kyc.bank.manualVerifyDescription}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {copy.kyc.bank.manualVerifyEsignNote}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleProofUpload(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={proofUploading || isProcessing || saving}
              onClick={() => fileInputRef.current?.click()}
            >
              {proofUploading
                ? copy.kyc.bank.proofUploading
                : proofUploaded
                  ? copy.kyc.bank.proofUploaded
                  : copy.kyc.bank.uploadProof}
            </Button>
            {proofFile ? (
              <p className="text-[11px] text-muted-foreground">{proofFile.name}</p>
            ) : null}
          </div>
        ) : null}

        {processError ? <FieldMessage message={processError} /> : null}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isProcessing || proofUploading || saving}
        className={cn("w-full", (isProcessing || saving) && "opacity-80")}
      >
        {buttonLabel}
      </Button>
    </form>
  );
}
