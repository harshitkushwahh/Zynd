"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycPanNameCard } from "@/features/kyc/components/kyc-pan-name-card";
import { verifyKycPan, type KycPanDraft, type KycPanVerifyResponse } from "@/features/kyc/lib/kyc-api";
import { normalizePersonNameInput } from "@/features/kyc/lib/kyc-name-validation";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

type KycPanStepProps = {
  disabled?: boolean;
  initialDraft?: KycPanDraft | null;
  initiallyVerified?: boolean;
  initialKycAlreadyRegistered?: boolean | null;
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
  onBlocked,
  onPanVerified,
  onPanReset,
  onSubmit,
}: KycPanStepProps) {
  const [panNumber, setPanNumber] = useState(initialDraft?.panNumber ?? "");
  const [middleName, setMiddleName] = useState(initialDraft?.middleName ?? "");
  const [panError, setPanError] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isVerified, setIsVerified] = useState(initiallyVerified);
  const [verifiedDraft, setVerifiedDraft] = useState<KycPanDraft | null>(initialDraft ?? null);
  const [requiresDigilocker, setRequiresDigilocker] = useState<boolean | null>(
    initialKycAlreadyRegistered == null ? null : !initialKycAlreadyRegistered,
  );
  const [kycAlreadyRegistered, setKycAlreadyRegistered] = useState<boolean | null>(
    initialKycAlreadyRegistered,
  );

  useEffect(() => {
    if (initialKycAlreadyRegistered == null) return;
    setKycAlreadyRegistered(initialKycAlreadyRegistered);
    setRequiresDigilocker(!initialKycAlreadyRegistered);
  }, [initialKycAlreadyRegistered]);

  useEffect(() => {
    if (!initialDraft) return;
    setPanNumber(initialDraft.panNumber);
    setMiddleName(initialDraft.middleName ?? "");
    setVerifiedDraft(initialDraft);
    setIsVerified(initiallyVerified);
  }, [initialDraft, initiallyVerified]);

  const handlePanChange = (value: string) => {
    setPanNumber(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
    setPanError("");
    setFetchError("");
    setIsVerified(false);
    setVerifiedDraft(null);
    setMiddleName("");
    setRequiresDigilocker(null);
    setKycAlreadyRegistered(null);
    onPanReset?.();
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

    onSubmit({
      ...verifiedDraft,
      middleName: middleName.trim(),
      requiresDigilocker: Boolean(requiresDigilocker),
      kycAlreadyRegistered: Boolean(kycAlreadyRegistered),
    });
  };

  const panName = verifiedDraft
    ? { firstName: verifiedDraft.firstName, lastName: verifiedDraft.lastName }
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <KycPanNameCard
          isFetched={isVerified}
          isFetching={isFetching}
          panName={panName}
          middleName={middleName}
          onMiddleNameChange={(value) => setMiddleName(normalizePersonNameInput(value))}
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
          disabled={disabled || isFetching || isVerified}
          aria-label={copy.kyc.pan.numberLabel}
          aria-invalid={Boolean(panError)}
          className="h-14 text-center font-mono text-h4 uppercase tracking-[0.2em]"
        />
        {panError ? <FieldMessage message={panError} /> : null}
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
