"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api-client";

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
  fetchKycIfsc,
} from "@/features/kyc/lib/kyc-api";
import { pollWithBackoff } from "@/features/kyc/lib/kyc-polling";
import {
  createEmptyBankForm,
  IFSC_PATTERN,
  isKycBankBranchPlaceholder,
  KYC_BANK_ACCOUNT_TYPE_OPTIONS,
  normalizeAccountNumber,
  normalizeIfscCode,
  type KycBankAccountDetails,
  type KycBankFormValue,
  type KycBankVerificationResult,
  bankAccountNumberOnFile,
  validateKycBankForm,
} from "@/features/kyc/lib/kyc-bank";
import { resolveAccountNumberDisplay } from "@/features/kyc/lib/kyc-sensitive-display";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycBankStepProps = {
  initialValue?: KycBankFormValue;
  initialAccountDetails?: KycBankAccountDetails | null;
  initialVerification?: KycBankVerificationResult | null;
  initialProofUploaded?: boolean;
  saving?: boolean;
  onSubmit: (value: KycBankFormValue & { accountDetails: KycBankAccountDetails }) => void;
};

export function KycBankStep({
  initialValue,
  initialAccountDetails,
  initialVerification,
  initialProofUploaded = false,
  saving = false,
  onSubmit,
}: KycBankStepProps) {
  const [form, setForm] = useState<KycBankFormValue>(() => initialValue ?? createEmptyBankForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof KycBankFormValue, string>>>({});
  const [processError, setProcessError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingIfsc, setIsFetchingIfsc] = useState(false);
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
  const [accountEntryActive, setAccountEntryActive] = useState(
    () => !bankAccountNumberOnFile(initialValue ?? createEmptyBankForm()),
  );

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
    setAccountEntryActive(true);
    setForm((current) => ({
      ...current,
      accountNumber: "",
      accountNumberLast4: "",
      accountNumberMasked: "",
    }));
  };

  const updateField = (field: keyof KycBankFormValue, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    resetVerificationState();
  };

  const updateAccountNumber = (value: string) => {
    const normalized = normalizeAccountNumber(value);
    setAccountEntryActive(true);
    setForm((current) => ({
      ...current,
      accountNumber: normalized,
      accountNumberLast4: normalized ? "" : current.accountNumberLast4,
      accountNumberMasked: normalized ? "" : current.accountNumberMasked,
    }));
    setFormErrors((current) => ({ ...current, accountNumber: undefined }));
    resetVerificationState();
  };

  const accountNumberOnFile = bankAccountNumberOnFile(form);
  const maskedAccountOnFile = accountNumberOnFile && !form.accountNumber.trim();
  const maskedAccountHint = maskedAccountOnFile ? resolveAccountNumberDisplay(form) ?? "" : "";
  const accountNumberLocked = isComplete || (maskedAccountOnFile && !accountEntryActive);

  const validateForm = () =>
    validateKycBankForm(form, {
      accountNumberOnFile: accountNumberOnFile && isComplete,
    });

  const mergeIfscIntoAccountDetails = async (
    ifscCode: string,
    details: KycBankAccountDetails,
  ): Promise<KycBankAccountDetails> => {
    if (details.branch.trim() && !isKycBankBranchPlaceholder(details.branch)) {
      return details;
    }
    const code = normalizeIfscCode(ifscCode);
    if (!IFSC_PATTERN.test(code)) {
      return details;
    }
    try {
      const result = await fetchKycIfsc(code);
      return {
        ...details,
        bankName: result.bank_name || details.bankName,
        branch: result.branch || details.branch,
      };
    } catch {
      return details;
    }
  };

  const applyIfscLookup = async (ifscCode: string, options?: { preserveVerification?: boolean }) => {
    const code = normalizeIfscCode(ifscCode);
    if (!IFSC_PATTERN.test(code)) {
      return;
    }

    const preserveVerification = options?.preserveVerification ?? isComplete;

    setIsFetchingIfsc(true);
    setProcessError("");
    try {
      const result = await fetchKycIfsc(code);
      setAccountDetails((current) => ({
        accountHolderName: preserveVerification ? current?.accountHolderName ?? "" : "",
        bankName: result.bank_name,
        branch: result.branch,
      }));
      if (preserveVerification) {
        setVerification((current) =>
          current
            ? { ...current, bankName: result.bank_name, branch: result.branch }
            : current,
        );
      } else {
        setVerification(null);
      }
      setFormErrors((current) => ({ ...current, ifscCode: undefined }));
    } catch (error) {
      if (!preserveVerification) {
        setAccountDetails(null);
      }
      const message =
        error instanceof ApiError
          ? error.message
          : copy.kyc.bank.ifscLookupFailed;
      setFormErrors((current) => ({ ...current, ifscCode: message }));
    } finally {
      setIsFetchingIfsc(false);
    }
  };

  const initialIfscRef = useRef(form.ifscCode);
  const didBootstrapIfscRef = useRef(false);

  useEffect(() => {
    if (didBootstrapIfscRef.current) {
      return;
    }
    didBootstrapIfscRef.current = true;
    const code = normalizeIfscCode(initialIfscRef.current);
    if (!IFSC_PATTERN.test(code)) {
      return;
    }
    void applyIfscLookup(code, { preserveVerification: isComplete });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap saved IFSC once on mount
  }, []);

  useEffect(() => {
    if (
      !isComplete ||
      !accountDetails ||
      (accountDetails.branch.trim() && !isKycBankBranchPlaceholder(accountDetails.branch))
    ) {
      return;
    }
    const code = normalizeIfscCode(form.ifscCode);
    if (!IFSC_PATTERN.test(code)) {
      return;
    }
    void mergeIfscIntoAccountDetails(code, accountDetails).then((enriched) => {
      if (enriched.branch === accountDetails.branch && enriched.bankName === accountDetails.bankName) {
        return;
      }
      setAccountDetails(enriched);
      setVerification((current) =>
        current ? { ...current, bankName: enriched.bankName, branch: enriched.branch } : current,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- backfill branch once when resuming verified bank
  }, [isComplete]);

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

    let nextAccountDetails: KycBankAccountDetails = {
      accountHolderName: result.account_holder_name,
      bankName: verificationResult.bankName,
      branch: verificationResult.branch,
    };
    nextAccountDetails = await mergeIfscIntoAccountDetails(form.ifscCode, nextAccountDetails);
    verificationResult.bankName = nextAccountDetails.bankName;
    verificationResult.branch = nextAccountDetails.branch;

    setAccountDetails(nextAccountDetails);
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
        const enriched = await mergeIfscIntoAccountDetails(form.ifscCode, nextAccountDetails);
        setAccountDetails(enriched);
        setVerification((current) =>
          current
            ? {
                ...current,
                bankVerified: true,
                readinessVerified: polled.readiness_verified ?? current.readinessVerified,
                bankName: enriched.bankName,
                branch: enriched.branch,
              }
            : current,
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
          isFetchingIfsc={isFetchingIfsc}
          isComplete={isComplete}
          accountDetails={accountDetails}
          verification={verification}
          ifscCode={form.ifscCode}
          onEdit={handleEditBankDetails}
        />

        <div className="space-y-2">
          <Label htmlFor="kyc-bank-account-number">{copy.kyc.bank.fields.accountNumber}</Label>
          <Input
            id="kyc-bank-account-number"
            inputMode="numeric"
            value={form.accountNumber}
            onChange={(event) => updateAccountNumber(event.target.value)}
            onFocus={() => {
              if (maskedAccountOnFile && !accountEntryActive) {
                setAccountEntryActive(true);
                setFormErrors((current) => ({ ...current, accountNumber: undefined }));
              }
            }}
            placeholder={
              maskedAccountHint && !accountEntryActive
                ? maskedAccountHint
                : copy.kyc.bank.placeholders.accountNumber
            }
            disabled={isProcessing || isComplete || saving}
            readOnly={accountNumberLocked}
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
            disabled={isProcessing || isFetchingIfsc || isComplete || saving}
            aria-invalid={Boolean(formErrors.ifscCode)}
            className="font-mono uppercase tracking-wide"
            onBlur={() => void applyIfscLookup(form.ifscCode)}
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
