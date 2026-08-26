"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycBankAccountCard } from "@/features/kyc/components/kyc-bank-account-card";
import { KycSelectField } from "@/features/kyc/components/kyc-select-field";
import {
  fetchInvestorBankAccountPreverifyStatus,
  uploadInvestorBankAccountProof,
  verifyInvestorBankAccount,
  verifyInvestorBankAccountManual,
  type InvestorBankAccount,
} from "@/features/invest/lib/investor-bank-accounts-api";
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
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export const ADD_BANK_ACCOUNT_FORM_ID = "add-bank-account-form";

export type AddBankAccountFormState = {
  busy: boolean;
  submitLabel: string;
  submitDisabled: boolean;
};

export type AddBankAccountFormProps = {
  onSuccess: (account: InvestorBankAccount) => void;
  onCancel?: () => void;
  showHeader?: boolean;
  formId?: string;
  hideFooter?: boolean;
  onFormStateChange?: (state: AddBankAccountFormState) => void;
  className?: string;
};

export function AddBankAccountForm({
  onSuccess,
  onCancel,
  showHeader = false,
  formId = ADD_BANK_ACCOUNT_FORM_ID,
  hideFooter = false,
  onFormStateChange,
  className,
}: AddBankAccountFormProps) {
  const [form, setForm] = useState<KycBankFormValue>(() => createEmptyBankForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof KycBankFormValue, string>>>({});
  const [processError, setProcessError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [accountDetails, setAccountDetails] = useState<KycBankAccountDetails | null>(null);
  const [verification, setVerification] = useState<KycBankVerificationResult | null>(null);
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetVerificationState = () => {
    setIsComplete(false);
    setAccountDetails(null);
    setVerification(null);
    setPendingAccountId(null);
    setProcessError("");
    setProofFile(null);
    setProofUploaded(false);
  };

  const updateField = (field: keyof KycBankFormValue, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    resetVerificationState();
  };

  const applyVerifyResponse = (result: Awaited<ReturnType<typeof verifyInvestorBankAccount>>) => {
    const verificationResult: KycBankVerificationResult = {
      panVerified: result.pan_verified,
      bankVerified: result.bank_verified,
      readinessVerified: result.readiness_verified,
      bankName: result.bank_name ?? "",
      branch: result.branch_name ?? "",
      requiresManualVerification: result.requires_manual_verification,
      requiresProofUpload: result.requires_proof_upload,
      preverifyId: result.preverify_id ?? undefined,
      failureReason: result.failure?.reason ?? undefined,
    };

    setPendingAccountId(result.id);
    setAccountDetails({
      accountHolderName: result.account_holder_name,
      bankName: verificationResult.bankName,
      branch: verificationResult.branch,
    });
    setVerification(verificationResult);
    setProofUploaded(result.proof_uploaded);

    if (result.bank_verified) {
      setIsComplete(true);
      onSuccess(result);
      return true;
    }

    return false;
  };

  const runHybridVerification = async () => {
    const result = await verifyInvestorBankAccount({
      account_number: form.accountNumber,
      account_type: form.accountType,
      ifsc_code: form.ifscCode,
    });

    if (!result.account_holder_name) {
      throw new Error(copy.kyc.bank.fetchFailed);
    }

    if (applyVerifyResponse(result)) {
      return;
    }

    if (
      result.preverify_id &&
      result.id &&
      !result.requires_manual_verification &&
      !result.requires_proof_upload
    ) {
      const polled = await pollWithBackoff(
        () => fetchInvestorBankAccountPreverifyStatus(result.id, result.preverify_id!),
        (status) => !status.bank_verified,
        { maxAttempts: 8, baseDelayMs: 1000 },
      );
      if (polled.bank_verified) {
        setVerification((current) =>
          current ? { ...current, bankVerified: true, readinessVerified: true } : current,
        );
        setIsComplete(true);
        onSuccess({ ...result, verification_status: "verified", bank_verified: true });
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
    if (!pendingAccountId) {
      setProcessError(copy.settings.bankAccounts.verifyNotStarted);
      return;
    }
    if (!proofUploaded) {
      setProcessError(copy.kyc.bank.proofRequired);
      return;
    }

    setIsProcessing(true);
    setProcessError("");
    try {
      const result = await verifyInvestorBankAccountManual(pendingAccountId);
      if (!result.success || !result.bank_verified) {
        throw new Error(result.failure?.reason ?? copy.kyc.bank.verifyFailed);
      }
      setVerification((current) =>
        current
          ? { ...current, bankVerified: true, readinessVerified: true, requiresManualVerification: false }
          : current,
      );
      setIsComplete(true);
      onSuccess(result);
    } catch (error) {
      setProcessError(error instanceof Error ? error.message : copy.kyc.bank.verifyFailed);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProofUpload = async (file: File) => {
    if (!pendingAccountId) {
      setProcessError(copy.settings.bankAccounts.verifyNotStarted);
      return;
    }

    setProofUploading(true);
    setProcessError("");
    try {
      await uploadInvestorBankAccountProof(pendingAccountId, file);
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

    const errors = validateKycBankForm(form);
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
    }
  };

  const showManualProof = Boolean(verification?.requiresManualVerification && !isComplete);
  const buttonLabel = isProcessing
    ? copy.kyc.bank.verifying
    : showManualProof
      ? copy.kyc.bank.verifyManual
      : copy.kyc.bank.verify;
  const busy = isProcessing || proofUploading;

  useEffect(() => {
    onFormStateChange?.({
      busy,
      submitLabel: buttonLabel,
      submitDisabled: busy || isComplete,
    });
  }, [busy, buttonLabel, isComplete, onFormStateChange]);

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className={cn(hideFooter ? "space-y-4" : "space-y-5", className)}
    >
      {showHeader ? (
        <div className="space-y-1">
          <h3 className="text-body font-semibold text-foreground">{copy.settings.bankAccounts.addTitle}</h3>
          <p className="text-caption text-muted-foreground">{copy.settings.bankAccounts.addDescription}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <KycBankAccountCard
          isProcessing={isProcessing}
          isComplete={isComplete}
          accountDetails={accountDetails}
          verification={verification}
          ifscCode={form.ifscCode}
        />

        <div className="space-y-2">
          <Label htmlFor="add-bank-account-number">{copy.kyc.bank.fields.accountNumber}</Label>
          <Input
            id="add-bank-account-number"
            inputMode="numeric"
            value={form.accountNumber}
            onChange={(event) => updateField("accountNumber", normalizeAccountNumber(event.target.value))}
            placeholder={copy.kyc.bank.placeholders.accountNumber}
            disabled={isProcessing || isComplete}
            aria-invalid={Boolean(formErrors.accountNumber)}
          />
          {formErrors.accountNumber ? <FieldMessage message={formErrors.accountNumber} /> : null}
        </div>

        <KycSelectField
          id="add-bank-account-type"
          label={copy.kyc.bank.fields.accountType}
          value={form.accountType}
          options={KYC_BANK_ACCOUNT_TYPE_OPTIONS}
          placeholder={copy.kyc.bank.placeholders.select}
          disabled={isProcessing || isComplete}
          hasError={Boolean(formErrors.accountType)}
          onChange={(value) => updateField("accountType", value)}
        />
        {formErrors.accountType ? <FieldMessage message={formErrors.accountType} /> : null}

        <div className="space-y-2">
          <Label htmlFor="add-bank-ifsc">{copy.kyc.bank.fields.ifscCode}</Label>
          <Input
            id="add-bank-ifsc"
            value={form.ifscCode}
            onChange={(event) => updateField("ifscCode", normalizeIfscCode(event.target.value))}
            placeholder={copy.kyc.bank.placeholders.ifscCode}
            autoComplete="off"
            spellCheck={false}
            disabled={isProcessing || isComplete}
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
              disabled={proofUploading || isProcessing}
              onClick={() => fileInputRef.current?.click()}
            >
              {proofUploading
                ? copy.kyc.bank.proofUploading
                : proofUploaded
                  ? copy.kyc.bank.proofUploaded
                  : copy.kyc.bank.uploadProof}
            </Button>
            {proofFile ? <p className="text-[11px] text-muted-foreground">{proofFile.name}</p> : null}
          </div>
        ) : null}

        {processError ? <FieldMessage message={processError} /> : null}
      </div>

      {!hideFooter ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              {copy.settings.bankAccounts.cancelAdd}
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={busy || isComplete}
            className={cn(busy && "opacity-80", !onCancel && "w-full sm:w-auto")}
          >
            {buttonLabel}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
