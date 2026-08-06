"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycPanNameCard } from "@/features/kyc/components/kyc-pan-name-card";
import {
  confirmKycPanNames,
  verifyKycPan,
  type KycPanDraft,
  type KycPanVerifyResponse,
} from "@/features/kyc/lib/kyc-api";
import { isDigilockerRequired } from "@/features/kyc/lib/kyc-pan-readiness";
import { normalizePersonNameInput, validateKycPersonName } from "@/features/kyc/lib/kyc-name-validation";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function hasPanNameFields(firstName: string, lastName: string) {
  return firstName.trim().length >= 2 && lastName.trim().length >= 2;
}

function isPanDraftVerified(
  draft: KycPanDraft | null | undefined,
  initiallyVerified: boolean,
) {
  if (initiallyVerified) return true;
  return Boolean(draft?.panNumber && hasPanNameFields(draft.firstName, draft.lastName));
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
  const [firstName, setFirstName] = useState(initialDraft?.firstName ?? "");
  const [middleName, setMiddleName] = useState(initialDraft?.middleName ?? "");
  const [lastName, setLastName] = useState(initialDraft?.lastName ?? "");
  const [panError, setPanError] = useState("");
  const [nameError, setNameError] = useState("");
  const [fetchError, setFetchError] = useState("");
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

  useEffect(() => {
    if (initialKycAlreadyRegistered == null && initialReadinessCode == null) return;
    setKycAlreadyRegistered(initialKycAlreadyRegistered);
    setRequiresDigilocker(isDigilockerRequired(initialKycAlreadyRegistered, initialReadinessCode));
  }, [initialKycAlreadyRegistered, initialReadinessCode]);

  useEffect(() => {
    if (!initialDraft) return;
    setPanNumber(initialDraft.panNumber);
    setFirstName(initialDraft.firstName);
    setMiddleName(initialDraft.middleName ?? "");
    setLastName(initialDraft.lastName);
    setVerifiedDraft(initialDraft);
    setIsVerified(isPanDraftVerified(initialDraft, initiallyVerified));
  }, [initialDraft, initiallyVerified]);

  const handlePanChange = (value: string) => {
    setPanNumber(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
    setPanError("");
    setNameError("");
    setFetchError("");
    setIsVerified(false);
    setVerifiedDraft(null);
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setRequiresDigilocker(null);
    setKycAlreadyRegistered(null);
    onPanReset?.();
  };

  const validateNames = () => {
    const firstError = validateKycPersonName(
      firstName,
      copy.kyc.pan.requiredField,
      copy.kyc.pan.invalidName,
    );
    if (firstError) {
      setNameError(firstError);
      return false;
    }

    if (middleName.trim()) {
      const middleError = validateKycPersonName(
        middleName,
        copy.kyc.pan.requiredField,
        copy.kyc.pan.invalidName,
      );
      if (middleError) {
        setNameError(middleError);
        return false;
      }
    }

    const lastError = validateKycPersonName(
      lastName,
      copy.kyc.pan.requiredField,
      copy.kyc.pan.invalidName,
    );
    if (lastError) {
      setNameError(lastError);
      return false;
    }

    setNameError("");
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!PAN_PATTERN.test(panNumber)) {
      setPanError(copy.kyc.pan.invalidPan);
      return;
    }

    if (!isVerified || !verifiedDraft) {
      setIsFetching(true);
      setFetchError("");
      try {
        const result = await verifyKycPan(panNumber);
        if (result.blocked) {
          onBlocked(result);
          return;
        }
        if (!result.success || !result.pan_draft) {
          setFetchError(copy.kyc.pan.fetchFailed);
          return;
        }
        setVerifiedDraft(result.pan_draft);
        setFirstName(result.pan_draft.firstName);
        setMiddleName(result.pan_draft.middleName ?? "");
        setLastName(result.pan_draft.lastName);
        setRequiresDigilocker(Boolean(result.requires_digilocker));
        setKycAlreadyRegistered(Boolean(result.kyc_already_registered));
        onPanVerified?.({
          kycAlreadyRegistered: Boolean(result.kyc_already_registered),
          readiness: result.readiness,
        });
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

    if (!validateNames()) return;

    setIsFetching(true);
    setFetchError("");
    try {
      const confirmResult = await confirmKycPanNames({
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
      });

      if (confirmResult.blocked) {
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

  const nameCardFetched = isVerified || hasPanNameFields(firstName, lastName);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <KycPanNameCard
          isFetched={nameCardFetched}
          isFetching={isFetching}
          panName={nameCardFetched ? { firstName, lastName } : null}
          middleName={middleName}
          onFirstNameChange={(value) => {
            setFirstName(normalizePersonNameInput(value));
            setNameError("");
          }}
          onMiddleNameChange={(value) => {
            setMiddleName(normalizePersonNameInput(value));
            setNameError("");
          }}
          onLastNameChange={(value) => {
            setLastName(normalizePersonNameInput(value));
            setNameError("");
          }}
          disabled={disabled}
          dateOfBirth={verifiedDraft?.dateOfBirth}
          panCategory={verifiedDraft?.panCategory}
        />

        <Input
          id="kyc-pan-number"
          value={panNumber}
          onChange={(event) => handlePanChange(event.target.value)}
          placeholder={copy.kyc.pan.numberPlaceholder}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled || isFetching || nameCardFetched}
          aria-label={copy.kyc.pan.numberLabel}
          aria-invalid={Boolean(panError)}
          className="h-14 text-center font-mono text-h4 uppercase tracking-[0.2em]"
        />
        {panError ? <FieldMessage message={panError} /> : null}
        {nameError ? <FieldMessage message={nameError} /> : null}
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
