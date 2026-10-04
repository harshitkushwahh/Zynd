"use client";

import { useEffect, useState } from "react";
import { PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycPanNameCard } from "@/features/kyc/components/kyc-pan-name-card";
import {
  confirmKycPanNames,
  verifyKycPan,
  type KycPanDraft,
  type KycPanFailure,
  type KycPanVerifyResponse,
} from "@/features/kyc/lib/kyc-api";
import { isDigilockerRequired } from "@/features/kyc/lib/kyc-pan-readiness";
import { normalizePersonNameInput, validateKycPersonName } from "@/features/kyc/lib/kyc-name-validation";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function draftFullName(draft: KycPanDraft | null | undefined) {
  if (!draft) return "";
  if (draft.fullName?.trim()) return draft.fullName.trim();
  return [draft.firstName, draft.middleName, draft.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function isPanDraftVerified(
  draft: KycPanDraft | null | undefined,
  initiallyVerified: boolean,
) {
  if (initiallyVerified) return true;
  return Boolean((draft?.panNumber || draft?.panMasked) && draftFullName(draft).length >= 2);
}

function panFailureMessage(failure: KycPanFailure) {
  const fallback =
    copy.kyc.pan.mismatch[failure.field as keyof typeof copy.kyc.pan.mismatch] ??
    copy.kyc.pan.verificationFailedDescription;
  return failure.reason?.trim() || fallback;
}

type KycPanStepProps = {
  disabled?: boolean;
  initialDraft?: KycPanDraft | null;
  initiallyVerified?: boolean;
  initialKycAlreadyRegistered?: boolean | null;
  initialReadinessCode?: string | null;
  onBlocked: (response: KycPanVerifyResponse) => void;
  onPanVerified?: (info: {
    kycAlreadyRegistered: boolean;
    readiness?: KycPanVerifyResponse["readiness"];
    panDraft: KycPanDraft;
  }) => void;
  onPanReset?: () => void;
  onSubmit: (details: KycPanDraft & { requiresDigilocker: boolean; kycAlreadyRegistered: boolean }) => void;
};

export function KycPanStep({
  disabled,
  initialDraft,
  initiallyVerified = false,
  initialKycAlreadyRegistered = null,
  initialReadinessCode = null,
  onBlocked,
  onPanVerified,
  onPanReset,
  onSubmit,
}: KycPanStepProps) {
  const [panNumber, setPanNumber] = useState(initialDraft?.panNumber ?? "");
  const [fullName, setFullName] = useState(() => draftFullName(initialDraft));
  const [dateOfBirth, setDateOfBirth] = useState(initialDraft?.dateOfBirth ?? "");
  const [panError, setPanError] = useState("");
  const [nameError, setNameError] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [panFailure, setPanFailure] = useState<KycPanFailure | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isVerified, setIsVerified] = useState(() =>
    isPanDraftVerified(initialDraft, initiallyVerified),
  );
  const [verifiedDraft, setVerifiedDraft] = useState<KycPanDraft | null>(initialDraft ?? null);
  const [requiresDigilocker, setRequiresDigilocker] = useState<boolean | null>(
    initialKycAlreadyRegistered == null
      ? null
      : isDigilockerRequired(initialKycAlreadyRegistered, initialReadinessCode),
  );
  const [kycAlreadyRegistered, setKycAlreadyRegistered] = useState<boolean | null>(
    initialKycAlreadyRegistered,
  );
  const [isPanReentry, setIsPanReentry] = useState(false);

  useEffect(() => {
    if (initialKycAlreadyRegistered == null && initialReadinessCode == null) return;
    setKycAlreadyRegistered(initialKycAlreadyRegistered);
    setRequiresDigilocker(isDigilockerRequired(initialKycAlreadyRegistered, initialReadinessCode));
  }, [initialKycAlreadyRegistered, initialReadinessCode]);

  useEffect(() => {
    if (!initialDraft || isPanReentry) return;

    const incomingPan = (initialDraft.panNumber ?? "").toUpperCase();
    const activePan = panNumber.toUpperCase();
    if (incomingPan && activePan && incomingPan !== activePan) return;

    if (initialDraft.panNumber) {
      setPanNumber(initialDraft.panNumber);
    } else if (!PAN_PATTERN.test(activePan)) {
      setPanNumber("");
    }

    setFullName(draftFullName(initialDraft));
    setDateOfBirth(initialDraft.dateOfBirth ?? "");
    setVerifiedDraft(initialDraft);
    setIsVerified(isPanDraftVerified(initialDraft, initiallyVerified));
    setPanError("");
  }, [initialDraft, initiallyVerified, isPanReentry, panNumber]);

  const handlePanChange = (value: string) => {
    setIsPanReentry(true);
    setPanNumber(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
    setPanError("");
    setNameError("");
    setFetchError("");
    setPanFailure(null);
    setIsVerified(false);
    setVerifiedDraft(null);
    setRequiresDigilocker(null);
    setKycAlreadyRegistered(null);
    onPanReset?.();
  };

  const handleEditPan = () => {
    setIsPanReentry(true);
    setPanError("");
    setNameError("");
    setFetchError("");
    setPanFailure(null);
    setIsVerified(false);
    setVerifiedDraft(null);
    setRequiresDigilocker(null);
    setKycAlreadyRegistered(null);
    onPanReset?.();
    window.requestAnimationFrame(() => {
      document.getElementById("kyc-pan-number")?.focus();
    });
  };

  const validateName = () => {
    const error = validateKycPersonName(fullName, copy.kyc.pan.requiredField, copy.kyc.pan.invalidName);
    if (error) {
      setNameError(error);
      return false;
    }
    setNameError("");
    return true;
  };

  const markDetailsEdited = () => {
    setNameError("");
    setFetchError("");
    setPanFailure(null);
    if (isVerified) {
      setIsVerified(false);
      setIsPanReentry(true);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isVerified || !verifiedDraft) {
      if (!PAN_PATTERN.test(panNumber)) {
        setPanError(copy.kyc.pan.invalidPan);
        return;
      }

      if (!validateName()) return;
      if (!dateOfBirth) {
        setNameError(copy.kyc.pan.requiredField);
        return;
      }

      setIsFetching(true);
      setFetchError("");
      setPanFailure(null);
      try {
        const result = await verifyKycPan({
          pan_number: panNumber,
          full_name: fullName.trim().replace(/\s+/g, " "),
          date_of_birth: dateOfBirth,
        });
        if (result.blocked) {
          if (result.block_type === "pan_verification" && result.failure) {
            setPanFailure(result.failure);
            return;
          }
          onBlocked(result);
          return;
        }
        if (!result.success || !result.pan_draft) {
          setFetchError(copy.kyc.pan.fetchFailed);
          return;
        }
        setVerifiedDraft(result.pan_draft);
        setFullName(draftFullName(result.pan_draft) || fullName);
        setDateOfBirth(result.pan_draft.dateOfBirth ?? dateOfBirth);
        setRequiresDigilocker(Boolean(result.requires_digilocker));
        setKycAlreadyRegistered(Boolean(result.kyc_already_registered));
        onPanVerified?.({
          kycAlreadyRegistered: Boolean(result.kyc_already_registered),
          readiness: result.readiness,
          panDraft: result.pan_draft,
        });
        setIsPanReentry(false);
        setIsVerified(true);
      } catch (error) {
        if (error instanceof ApiError && error.message !== "Request failed") {
          setFetchError(error.message);
        } else {
          setFetchError(copy.kyc.pan.fetchFailed);
        }
      } finally {
        setIsFetching(false);
      }
      return;
    }

    if (!validateName()) return;

    setIsFetching(true);
    setFetchError("");
    try {
      const confirmResult = await confirmKycPanNames({
        full_name: fullName.trim().replace(/\s+/g, " "),
      });

      if (confirmResult.blocked) {
        if (confirmResult.block_type === "pan_verification" && confirmResult.failure) {
          setPanFailure(confirmResult.failure);
          return;
        }
        onBlocked({
          success: false,
          blocked: true,
          block_type: confirmResult.block_type,
          failure: confirmResult.failure,
        });
        return;
      }

      if (!confirmResult.success || !confirmResult.pan_draft) {
        setFetchError(copy.kyc.pan.fetchFailed);
        return;
      }

      const digilockerRequired =
        confirmResult.requires_digilocker ??
        isDigilockerRequired(kycAlreadyRegistered, initialReadinessCode);
      setRequiresDigilocker(Boolean(digilockerRequired));

      onSubmit({
        ...confirmResult.pan_draft,
        panNumber: panNumber || confirmResult.pan_draft.panNumber || verifiedDraft.panNumber || "",
        panMasked: confirmResult.pan_draft.panMasked ?? verifiedDraft.panMasked,
        requiresDigilocker: Boolean(digilockerRequired),
        kycAlreadyRegistered: Boolean(kycAlreadyRegistered),
      });
    } catch (error) {
      if (error instanceof ApiError && error.message !== "Request failed") {
        setFetchError(error.message);
      } else {
        setFetchError(copy.kyc.pan.fetchFailed);
      }
    } finally {
      setIsFetching(false);
    }
  };

  const panLocked = isVerified && !isPanReentry && !disabled && !isFetching;
  const panDisplayValue =
    panLocked && !panNumber && verifiedDraft?.panMasked ? verifiedDraft.panMasked : panNumber;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="kyc-pan-number" className="text-caption font-medium text-muted-foreground">
            {copy.kyc.pan.numberLabel}
          </label>

          <div className="relative">
            <Input
              id="kyc-pan-number"
              value={panDisplayValue}
              onChange={(event) => handlePanChange(event.target.value)}
              placeholder={copy.kyc.pan.numberPlaceholder}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled || isFetching || panLocked}
              aria-label={copy.kyc.pan.numberLabel}
              aria-invalid={Boolean(panError)}
              className={cn(
                "h-14 text-center font-mono text-h4 uppercase tracking-[0.2em]",
                panLocked && "pr-12",
              )}
            />
            {panLocked ? (
              <button
                type="button"
                onClick={handleEditPan}
                className="absolute top-1/2 right-3 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] text-primary transition-colors hover:bg-primary/10"
                aria-label={copy.kyc.pan.editPan}
              >
                <PencilLine className="size-4" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        {panError ? <FieldMessage message={panError} /> : null}
        {panFailure?.field === "pan" ? <FieldMessage message={panFailureMessage(panFailure)} /> : null}

        <KycPanNameCard
          fullName={fullName}
          onFullNameChange={(value) => {
            setFullName(normalizePersonNameInput(value));
            markDetailsEdited();
          }}
          dateOfBirth={dateOfBirth}
          onDateOfBirthChange={(value) => {
            setDateOfBirth(value);
            markDetailsEdited();
          }}
          nameInvalid={Boolean(nameError) || panFailure?.field === "name"}
          dateOfBirthInvalid={panFailure?.field === "date_of_birth"}
          disabled={disabled || isFetching}
        />
        {nameError ? <FieldMessage message={nameError} /> : null}
        {panFailure && panFailure.field !== "pan" ? (
          <FieldMessage message={panFailureMessage(panFailure)} />
        ) : null}
        {fetchError ? <FieldMessage message={fetchError} /> : null}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={disabled || isFetching}
        className={cn("w-full", isFetching && "opacity-80")}
      >
        {isFetching
          ? copy.kyc.pan.fetching
          : isVerified
            ? copy.kyc.continue
            : copy.kyc.pan.verifyPan}
      </Button>
    </form>
  );
}
