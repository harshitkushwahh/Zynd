"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKyc } from "@/contexts/kyc-context";
import { KycAddressStep } from "@/features/kyc/components/kyc-address-step";
import { KycDialogBody } from "@/features/kyc/components/kyc-dialog-body";
import { KycDialogChrome } from "@/features/kyc/components/kyc-dialog-chrome";
import { KycDialogProgressState } from "@/features/kyc/components/kyc-dialog-progress-state";
import { KycEntryGate } from "@/features/kyc/components/kyc-entry-gate";
import { KycOutcomePanel } from "@/features/kyc/components/kyc-outcome-panel";
import { KycPanBlockDialog } from "@/features/kyc/components/kyc-pan-block-dialog";
import { KycPanLottie } from "@/features/kyc/components/kyc-pan-lottie";
import { KycPanStep } from "@/features/kyc/components/kyc-pan-step";
import { KycBankStep } from "@/features/kyc/components/kyc-bank-step";
import { KycNomineeStep } from "@/features/kyc/components/kyc-nominee-step";
import { KycNomineeFamilyGroupDialog } from "@/features/kyc/components/kyc-nominee-family-group-dialog";
import {
  addNomineeToFamilyGroup,
  previewNomineeFamilyGroupAdd,
} from "@/features/family-groups/api/family-groups-api";
import {
  filterNomineesForFamilyPrompt,
  isActionableFamilyPreviewStatus,
} from "@/features/family-groups/lib/kyc-nominee-family-bridge";
import { KycPersonalInfoStep } from "@/features/kyc/components/kyc-personal-info-step";
import { KycReviewStep } from "@/features/kyc/components/kyc-review-step";
import { KycSignatureStep } from "@/features/kyc/components/kyc-signature-step";
import { KycEsignDialog } from "@/features/kyc/components/kyc-esign-dialog";
import { KycLocationRequiredDialog } from "@/features/kyc/components/kyc-location-required-dialog";
import { KycPanReadinessBadge } from "@/features/kyc/components/kyc-pan-readiness-badge";
import { KycStepHero } from "@/features/kyc/components/kyc-step-hero";
import {
  ensureKycToken,
  checkKycReadiness,
  continueKycForm,
  fetchKycBootstrap,
  fetchKycFormStatus,
  fetchKycCountries,
  fetchKycIdentityDocument,
  fetchKycMasterDataEnums,
  fetchKycNomineeEnums,
  fetchKycStates,
  saveKycJourneyState,
  startKycDigilocker,
  submitKycForm,
  type KycBootstrapResponse,
  type KycFormActionResponse,
  type KycNomineeEnums,
  type KycPanVerifyResponse,
} from "@/features/kyc/lib/kyc-api";
import { getKycBootstrapErrorMessage } from "@/features/kyc/lib/kyc-bootstrap-error";
import { pollWithBackoff } from "@/features/kyc/lib/kyc-polling";
import { INDIAN_STATES } from "@/features/kyc/lib/indian-states";
import {
  createEmptyBankForm,
  type KycBankFormValue,
} from "@/features/kyc/lib/kyc-bank";
import type { KycNomineeRecord } from "@/features/kyc/lib/kyc-nominee";
import {
  readinessFromBootstrap,
  type KycReadinessInfo,
} from "@/features/kyc/lib/kyc-pan-readiness";
import {
  KycGeolocationError,
  requestKycGeolocation,
  type KycGeolocationResult,
} from "@/features/kyc/lib/kyc-geolocation";
import {
  createEmptyJourneyDraft,
  type KycJourneyDraft,
  type KycSignatureDraft,
} from "@/features/kyc/lib/kyc-journey-draft";
import {
  getKycJourneySteps,
  requiresFullKycSubmission,
} from "@/features/kyc/lib/kyc-journey";
import {
  createEmptyAddressForm,
  type KycAddressFormValue,
} from "@/features/kyc/lib/kyc-address";
import type { KycPersonalInfoValue } from "@/features/kyc/lib/kyc-personal-info";
import { createEmptyPersonalInfo } from "@/features/kyc/lib/kyc-personal-info";
import { copy } from "@/shared/config/copy";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type KycDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function mapContactDraft(raw: Record<string, unknown> | null | undefined): KycAddressFormValue | undefined {
  if (!raw) return undefined;
  const permanent = (raw.permanent as KycAddressFormValue["permanent"] | undefined) ?? undefined;
  if (!permanent) return undefined;
  return {
    permanent,
    correspondence: (raw.correspondence as KycAddressFormValue["correspondence"] | undefined) ?? permanent,
    sameAsPermanent: Boolean(raw.sameAsPermanent ?? true),
  };
}

function mapPersonalDraft(raw: Record<string, unknown> | null | undefined): Partial<KycPersonalInfoValue> | undefined {
  if (!raw) return undefined;
  return raw as Partial<KycPersonalInfoValue>;
}

function mapNomineeDraft(raw: Record<string, unknown>[] | null | undefined): KycNomineeRecord[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw as KycNomineeRecord[];
}

function mapBankDraft(raw: Record<string, unknown> | null | undefined) {
  if (!raw) return undefined;
  const form: KycBankFormValue = {
    accountNumber: String(raw.accountNumber ?? ""),
    accountType: String(raw.accountType ?? ""),
    ifscCode: String(raw.ifscCode ?? ""),
  };
  const accountDetails =
    raw.accountHolderName || raw.bankName || raw.branch
      ? {
          accountHolderName: String(raw.accountHolderName ?? ""),
          bankName: String(raw.bankName ?? ""),
          branch: String(raw.branch ?? ""),
        }
      : null;
  return {
    form,
    accountDetails,
    readinessVerified: raw.readinessVerified === true,
  };
}

function resolveJourneySaveError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return copy.kyc.journeySaveFailed;
}

export function KycDialog({ open, onOpenChange }: KycDialogProps) {
  const {
    status,
    record,
    kycAllowed,
    kycBlockReasons,
    markKycSubmitted,
    markKycVerified,
    applyReadinessCheck,
    refreshFromBootstrap,
    openDialog,
    digilockerResumeToken,
    kycSubmissionResumeToken,
  } = useKyc();

  const [bootstrap, setBootstrap] = useState<KycBootstrapResponse | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [journeyDraft, setJourneyDraft] = useState<KycJourneyDraft>(() => createEmptyJourneyDraft());
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [masterEnums, setMasterEnums] = useState<Awaited<ReturnType<typeof fetchKycMasterDataEnums>> | null>(null);
  const [nationalityOptions, setNationalityOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [prefilledFromDigilocker, setPrefilledFromDigilocker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockDialog, setBlockDialog] = useState<{ title: string; description: string } | null>(null);
  const [nomineeEnums, setNomineeEnums] = useState<KycNomineeEnums | null>(null);
  const [digilockerInfoOpen, setDigilockerInfoOpen] = useState(false);
  const [esignDialogOpen, setEsignDialogOpen] = useState(false);
  const [pendingEsignUrl, setPendingEsignUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOutcomeShown, setSubmittedOutcomeShown] = useState(false);
  const [kraVerifiedOutcomeShown, setKraVerifiedOutcomeShown] = useState(false);
  const [checkingKraStatus, setCheckingKraStatus] = useState(false);
  const [kraCheckMessage, setKraCheckMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [journeySaveError, setJourneySaveError] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [panReadiness, setPanReadiness] = useState<KycReadinessInfo | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [familyPromptQueue, setFamilyPromptQueue] = useState<KycNomineeRecord[]>([]);
  const [familyPromptOpen, setFamilyPromptOpen] = useState(false);
  const [familyPromptNominee, setFamilyPromptNominee] = useState<KycNomineeRecord | null>(null);
  const [familyPromptSkippedIds, setFamilyPromptSkippedIds] = useState<string[]>([]);
  const [reviewFamilyRepromptNominee, setReviewFamilyRepromptNominee] = useState<KycNomineeRecord | null>(
    null,
  );
  const [reviewFamilyRepromptChecked, setReviewFamilyRepromptChecked] = useState(false);
  const [familyReviewDialogOpen, setFamilyReviewDialogOpen] = useState(false);

  const processSubmissionResult = useCallback(
    async (result: KycFormActionResponse) => {
      if (result.next_action === "proof_redirect" && result.redirect_url) {
        window.location.assign(result.redirect_url);
        return;
      }
      if (result.next_action === "esign_redirect" && result.redirect_url) {
        setPendingEsignUrl(result.redirect_url);
        setEsignDialogOpen(true);
        return;
      }
      if (result.next_action === "submitted") {
        markKycSubmitted();
        setSubmittedOutcomeShown(true);
        setSubmitError(null);
        return;
      }
      if (result.next_action === "completed") {
        markKycVerified(journeyDraft.pan?.panNumber ?? bootstrap?.pan_draft?.panNumber);
        setSubmittedOutcomeShown(false);
        setKraVerifiedOutcomeShown(true);
        setSubmitError(null);
        return;
      }
      if (result.next_action === "failed") {
        setSubmitError(result.failure_reason ?? result.message ?? copy.kyc.submitFailedTitle);
        return;
      }
      if (result.next_action === "processing") {
        let continued = await continueKycForm();
        if (continued.next_action === "processing") {
          continued = await pollWithBackoff(
            () => fetchKycFormStatus(),
            (status) => status.next_action === "processing",
            { maxAttempts: 6, baseDelayMs: 750 },
          );
        }
        if (continued.next_action === "processing") {
          setSubmitError(continued.message ?? copy.kyc.submitFailedTitle);
          return;
        }
        await processSubmissionResult(continued);
      }
    },
    [markKycSubmitted, markKycVerified, bootstrap?.pan_draft?.panNumber, journeyDraft.pan?.panNumber],
  );

  const applyBootstrap = useCallback((payload: KycBootstrapResponse) => {
    setBootstrap(payload);
    const fullKycRequired = requiresFullKycSubmission({
      kyc_already_registered: payload.kyc_already_registered,
      readiness_code: payload.readiness_code,
    });
    const steps = getKycJourneySteps(fullKycRequired);
    setActiveStepIndex(Math.min(payload.active_step_index ?? 0, steps.length - 1));
    const signatureDraft = payload.signature_draft as KycSignatureDraft | null | undefined;
    setJourneyDraft({
      pan: payload.pan_draft ?? undefined,
      address: mapContactDraft(payload.contact_draft),
      personalInfo: mapPersonalDraft(payload.personal_draft) as KycPersonalInfoValue | undefined,
      nominees: mapNomineeDraft(payload.nominee_draft),
      bank: (() => {
        const mapped = mapBankDraft(payload.bank_draft);
        if (!mapped?.form || !mapped.accountDetails) return undefined;
        return { ...mapped.form, accountDetails: mapped.accountDetails };
      })(),
      signature: signatureDraft ?? undefined,
    });
    setSubmittedOutcomeShown(payload.step_statuses?.overall === "submitted");
    setKraVerifiedOutcomeShown(payload.step_statuses?.overall === "completed");
    setKraCheckMessage(null);
    setPanReadiness(readinessFromBootstrap(payload));
    setPrefilledFromDigilocker(
      Boolean(payload.contact_draft && !payload.kyc_already_registered && payload.external_kyc_status === "returned_success"),
    );
  }, []);

  const handleCheckKraStatus = useCallback(async () => {
    setCheckingKraStatus(true);
    setKraCheckMessage(null);
    try {
      const result = await checkKycReadiness();
      applyReadinessCheck(result);
      const payload = await fetchKycBootstrap();
      applyBootstrap(payload);
      await refreshFromBootstrap();
      if (result.kra_verified) {
        markKycVerified(bootstrap?.pan_draft?.panNumber);
        setSubmittedOutcomeShown(false);
        setKraVerifiedOutcomeShown(true);
        setKraCheckMessage(null);
        return;
      }
      setKraCheckMessage(result.message || copy.kyc.checkStatusPendingDescription);
    } catch (error) {
      setKraCheckMessage(error instanceof Error ? error.message : copy.kyc.checkStatusPendingDescription);
    } finally {
      setCheckingKraStatus(false);
    }
  }, [
    applyBootstrap,
    applyReadinessCheck,
    bootstrap?.pan_draft?.panNumber,
    markKycVerified,
    refreshFromBootstrap,
  ]);

  const loadBootstrap = useCallback(async () => {
    setLoadingBootstrap(true);
    setBootstrapError(null);
    try {
      await ensureKycToken();
      const payload = await fetchKycBootstrap();
      applyBootstrap(payload);

      const [statesResult, countriesResult, enumsResult] = await Promise.allSettled([
        fetchKycStates(),
        fetchKycCountries(),
        fetchKycMasterDataEnums(),
      ]);

      if (statesResult.status === "fulfilled") {
        const names = statesResult.value
          .map((item) => item.name)
          .filter((name): name is string => Boolean(name));
        setStateOptions(names.length > 0 ? names : [...INDIAN_STATES]);
      } else {
        setStateOptions([...INDIAN_STATES]);
      }

      if (countriesResult.status === "fulfilled") {
        setNationalityOptions(
          countriesResult.value.map((item) => ({ label: item.name, value: item.name })),
        );
      }

      if (enumsResult.status === "fulfilled") {
        setMasterEnums(enumsResult.value);
      } else {
        throw enumsResult.reason;
      }
      if (
        payload.step_statuses?.overall === "phase1_complete" ||
        payload.step_statuses?.overall === "phase2_complete" ||
        payload.last_completed_step === "personal" ||
        payload.last_completed_step === "nominee" ||
        payload.last_completed_step === "bank"
      ) {
        const nomineeData = await fetchKycNomineeEnums();
        setNomineeEnums(nomineeData);
      }
    } catch (error) {
      setBootstrapError(getKycBootstrapErrorMessage(error));
    } finally {
      setLoadingBootstrap(false);
    }
  }, [applyBootstrap]);

  useEffect(() => {
    if (!open || !kycAllowed) return;
    void loadBootstrap();
  }, [open, kycAllowed, loadBootstrap, digilockerResumeToken, kycSubmissionResumeToken]);

  useEffect(() => {
    if (!open) {
      setActiveStepIndex(0);
      setJourneyDraft(createEmptyJourneyDraft());
      setBootstrap(null);
      setPrefilledFromDigilocker(false);
      setBlockDialog(null);
      setSubmittedOutcomeShown(false);
      setSubmitError(null);
      setPanReadiness(null);
      setNomineeEnums(null);
      setEsignDialogOpen(false);
      setPendingEsignUrl(null);
      setFamilyPromptQueue([]);
      setFamilyPromptOpen(false);
      setFamilyPromptNominee(null);
      setFamilyPromptSkippedIds([]);
      setReviewFamilyRepromptNominee(null);
      setReviewFamilyRepromptChecked(false);
      setFamilyReviewDialogOpen(false);
    }
  }, [open]);

  const requiresExitConfirm = status === "none" || status === "pending";

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (requiresExitConfirm) {
        setExitConfirmOpen(true);
        return;
      }
      onOpenChange(false);
      return;
    }
    onOpenChange(true);
  };

  const updateDraft = (patch: Partial<KycJourneyDraft>) => {
    setJourneyDraft((current) => ({ ...current, ...patch }));
  };

  const requiresFullKyc = requiresFullKycSubmission({
    kyc_already_registered: bootstrap?.kyc_already_registered,
    readiness_code: bootstrap?.readiness_code,
  });
  const journeySteps = useMemo(() => getKycJourneySteps(requiresFullKyc), [requiresFullKyc]);

  const goToNextStep = () => {
    setActiveStepIndex((current) => Math.min(current + 1, journeySteps.length - 1));
  };

  const advanceFamilyPromptQueue = useCallback(() => {
    setFamilyPromptQueue((remaining) => {
      if (remaining.length === 0) {
        setFamilyPromptOpen(false);
        setFamilyPromptNominee(null);
        setActiveStepIndex((current) => Math.min(current + 1, journeySteps.length - 1));
        return [];
      }
      const [next, ...rest] = remaining;
      setFamilyPromptNominee(next);
      setFamilyPromptOpen(true);
      return rest;
    });
  }, [journeySteps.length]);

  const handleFamilyPromptCompleted = useCallback(
    (result: "invited" | "skipped" | "blocked") => {
      if (familyPromptNominee && result === "skipped") {
        setFamilyPromptSkippedIds((current) =>
          current.includes(familyPromptNominee.id) ? current : [...current, familyPromptNominee.id],
        );
      }
      advanceFamilyPromptQueue();
    },
    [advanceFamilyPromptQueue, familyPromptNominee],
  );

  const handleReviewFamilyPromptCompleted = useCallback(
    (result: "invited" | "skipped" | "blocked") => {
      setFamilyReviewDialogOpen(false);
      setReviewFamilyRepromptNominee(null);
      if (result === "skipped" && reviewFamilyRepromptNominee) {
        setFamilyPromptSkippedIds((current) =>
          current.filter((id) => id !== reviewFamilyRepromptNominee.id),
        );
      }
    },
    [reviewFamilyRepromptNominee],
  );

  const handlePanBlocked = (response: KycPanVerifyResponse) => {
    if (response.block_type === "corporate_pan") {
      setBlockDialog({
        title: copy.kyc.pan.corporatePanTitle,
        description: response.message ?? copy.kyc.pan.corporatePanDescription,
      });
      return;
    }
    if (response.block_type === "readiness_terminal") {
      setBlockDialog({
        title: copy.kyc.pan.readinessBlockedTitle,
        description: response.message ?? copy.kyc.pan.readinessBlockedDescription,
      });
      return;
    }
    const reason =
      response.failure?.reason ??
      response.message ??
      copy.kyc.pan.verificationFailedDescription;
    setBlockDialog({
      title: copy.kyc.pan.verificationFailedTitle,
      description: reason,
    });
  };

  const handlePanSubmit = async (details: {
    panNumber: string;
    firstName: string;
    lastName: string;
    middleName: string;
    dateOfBirth?: string;
    panCategory?: string;
    requiresDigilocker: boolean;
    kycAlreadyRegistered: boolean;
  }) => {
    setSaving(true);
    try {
      await saveKycJourneyState({
        middle_name: details.middleName,
        last_completed_step: "pan",
      });
      updateDraft({
        pan: {
          panNumber: details.panNumber,
          firstName: details.firstName,
          lastName: details.lastName,
          middleName: details.middleName,
          dateOfBirth: details.dateOfBirth,
          panCategory: details.panCategory,
        },
      });

      if (details.requiresDigilocker) {
        const { redirect_url: redirectUrl } = await startKycDigilocker();
        window.location.assign(redirectUrl);
        return;
      }

      setPrefilledFromDigilocker(false);
      goToNextStep();
    } finally {
      setSaving(false);
    }
  };

  const resumeDigilockerReturn = useCallback(async () => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("kyc_digilocker_return") !== "1") return;

    const documentId = params.get("identity_document");
    const fetchStatus = params.get("status");
    params.delete("kyc_digilocker_return");
    params.delete("identity_document");
    params.delete("status");
    params.delete("digilocker_error");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    if (!documentId || fetchStatus !== "successful") {
      setDigilockerInfoOpen(true);
      return;
    }

    setSaving(true);
    try {
      const result = await fetchKycIdentityDocument(documentId);
      if (!result.success) {
        setDigilockerInfoOpen(true);
        return;
      }
      const address = mapContactDraft(result.contact_draft ?? null);
      if (address) {
        updateDraft({
          address,
          personalInfo: {
            ...createEmptyPersonalInfo(),
            ...(mapPersonalDraft(result.personal_draft) as Partial<KycPersonalInfoValue>),
          },
        });
        setPrefilledFromDigilocker(true);
      }
      setActiveStepIndex(1);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void resumeDigilockerReturn();
  }, [open, resumeDigilockerReturn, digilockerResumeToken]);

  const handleAddressSubmit = async (value: KycAddressFormValue) => {
    setSaving(true);
    setJourneySaveError(null);
    try {
      await saveKycJourneyState({
        contact_draft_json: value as unknown as Record<string, unknown>,
        last_completed_step: "address",
      });
      updateDraft({ address: value });
      goToNextStep();
    } catch (error) {
      setJourneySaveError(resolveJourneySaveError(error));
    } finally {
      setSaving(false);
    }
  };

  const handlePersonalSubmit = async (value: KycPersonalInfoValue) => {
    setSaving(true);
    setJourneySaveError(null);
    try {
      await saveKycJourneyState({
        personal_draft_json: value as unknown as Record<string, unknown>,
        last_completed_step: "personal",
      });
      updateDraft({ personalInfo: value });
      if (!nomineeEnums) {
        const nomineeData = await fetchKycNomineeEnums();
        setNomineeEnums(nomineeData);
      }
      goToNextStep();
    } catch (error) {
      setJourneySaveError(resolveJourneySaveError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleNomineeSubmit = async (nominees: KycNomineeRecord[]) => {
    setSaving(true);
    setJourneySaveError(null);
    try {
      await saveKycJourneyState({
        nominee_draft_json: nominees as unknown as Record<string, unknown>[],
        last_completed_step: "nominee",
      });
      updateDraft({ nominees });

      const eligible = filterNomineesForFamilyPrompt(nominees);
      if (eligible.length === 0) {
        goToNextStep();
        return;
      }

      const queue: KycNomineeRecord[] = [];
      for (const nominee of eligible) {
        try {
          const preview = await previewNomineeFamilyGroupAdd({
            nominee_email: nominee.contact.email.trim(),
            nominee_name: nominee.core.fullName.trim(),
            relationship: nominee.core.relationship,
            kyc_nominee_id: nominee.id,
          });
          if (isActionableFamilyPreviewStatus(preview.status)) {
            queue.push(nominee);
          }
        } catch {
          // Non-blocking — continue KYC if family group preview fails.
        }
      }

      if (queue.length === 0) {
        goToNextStep();
        return;
      }

      const [first, ...rest] = queue;
      setFamilyPromptQueue(rest);
      setFamilyPromptNominee(first);
      setFamilyPromptOpen(true);
    } catch (error) {
      setJourneySaveError(resolveJourneySaveError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleBankSubmit = async (
    value: KycBankFormValue & {
      accountDetails: { accountHolderName: string; bankName: string; branch: string };
    },
  ) => {
    setSaving(true);
    setJourneySaveError(null);
    try {
      await saveKycJourneyState({
        bank_draft_json: {
          ...value,
          accountHolderName: value.accountDetails.accountHolderName,
          bankName: value.accountDetails.bankName,
          branch: value.accountDetails.branch,
          verificationStatus: "verified",
        } as unknown as Record<string, unknown>,
        last_completed_step: "bank",
      });
      updateDraft({ bank: value });
      goToNextStep();
    } catch (error) {
      setJourneySaveError(resolveJourneySaveError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureSubmit = async (value: KycSignatureDraft) => {
    setSaving(true);
    setJourneySaveError(null);
    try {
      await saveKycJourneyState({
        signature_draft_json: value as unknown as Record<string, unknown>,
        last_completed_step: "signature",
      });
      updateDraft({ signature: value });
      goToNextStep();
    } catch (error) {
      setJourneySaveError(resolveJourneySaveError(error));
    } finally {
      setSaving(false);
    }
  };

  const submitKycWithLocation = async (coords: KycGeolocationResult) => {
    const result = await submitKycForm({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_meters: coords.accuracy,
    });
    await processSubmissionResult(result);
  };

  const handleLocationRequest = async () => {
    setSubmitting(true);
    setLocationLoading(true);
    setLocationError(null);
    setSubmitError(null);
    try {
      const coords = await requestKycGeolocation();
      setLocationDialogOpen(false);
      await submitKycWithLocation(coords);
    } catch (error) {
      if (error instanceof KycGeolocationError) {
        setLocationError(error.message);
        setLocationDialogOpen(true);
        return;
      }
      if (error instanceof ApiError && error.code.startsWith("location_")) {
        setLocationError(error.message);
        setLocationDialogOpen(true);
        return;
      }
      setSubmitError(error instanceof Error ? error.message : copy.kyc.submitFailedTitle);
    } finally {
      setLocationLoading(false);
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async () => {
    setSubmitError(null);
    setLocationError(null);

    if (!requiresFullKyc) {
      setSubmitting(true);
      try {
        const result = await submitKycForm();
        await processSubmissionResult(result);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : copy.kyc.submitFailedTitle);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setLocationDialogOpen(true);
  };

  const resumeSubmissionReturn = useCallback(async () => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const proofReturn = params.get("kyc_proof_return") === "1";
    const esignReturn = params.get("kyc_esign_return") === "1";
    if (!proofReturn && !esignReturn) return;

    const callbackStatus = params.get("status");
    params.delete("kyc_proof_return");
    params.delete("kyc_esign_return");
    params.delete("kyc_form_id");
    params.delete("status");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    if (callbackStatus !== "successful") {
      setSubmitError(copy.kyc.digilocker.failedDescription);
      return;
    }

    setSubmitting(true);
    try {
      const result = await continueKycForm();
      await processSubmissionResult(result);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : copy.kyc.submitFailedTitle);
    } finally {
      setSubmitting(false);
    }
  }, [processSubmissionResult]);

  useEffect(() => {
    if (!open) return;
    void resumeSubmissionReturn();
  }, [open, resumeSubmissionReturn, kycSubmissionResumeToken]);

  const activeStepId = journeySteps[activeStepIndex]?.id;
  const isOutcomeView = submittedOutcomeShown || kraVerifiedOutcomeShown;
  const panVerified = bootstrap?.pan_verification_status === "verified";
  const submittedPan = bootstrap?.pan_draft?.panNumber ?? journeyDraft.pan?.panNumber;

  useEffect(() => {
    if (activeStepId !== "review" || reviewFamilyRepromptChecked || familyPromptSkippedIds.length === 0) {
      return;
    }

    const nominees = journeyDraft.nominees ?? [];
    const nominee = nominees.find((item) => familyPromptSkippedIds.includes(item.id));
    if (!nominee) {
      setReviewFamilyRepromptChecked(true);
      return;
    }

    let cancelled = false;
    setReviewFamilyRepromptChecked(true);

    void previewNomineeFamilyGroupAdd({
      nominee_email: nominee.contact.email.trim(),
      nominee_name: nominee.core.fullName.trim(),
      relationship: nominee.core.relationship,
      kyc_nominee_id: nominee.id,
    })
      .then((preview) => {
        if (cancelled) return;
        if (isActionableFamilyPreviewStatus(preview.status)) {
          setReviewFamilyRepromptNominee(nominee);
        }
      })
      .catch(() => {
        // Non-blocking — review submit must remain available.
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeStepId,
    familyPromptSkippedIds,
    journeyDraft.nominees,
    reviewFamilyRepromptChecked,
  ]);

  const enumOptions = useMemo(
    () =>
      masterEnums
        ? {
            gender: masterEnums.gender,
            incomeSlab: masterEnums.income_slab,
            occupation: masterEnums.occupation,
            maritalStatus: masterEnums.marital_status,
            pepExposed: masterEnums.pep_exposed,
          }
        : undefined,
    [masterEnums],
  );

  const renderJourneyStep = () => {
    if (loadingBootstrap) {
      return <KycDialogProgressState variant="loading" />;
    }

    if (bootstrapError) {
      return (
        <KycDialogProgressState
          variant="error"
          message={bootstrapError}
          onRetry={() => void loadBootstrap()}
          retrying={loadingBootstrap}
        />
      );
    }

    switch (activeStepId) {
      case "pan-card":
        return (
          <div className="space-y-6">
            <KycStepHero
              media={<KycPanLottie className="flex justify-center" />}
              badge={<KycPanReadinessBadge readiness={panReadiness} />}
              descriptionLines={copy.kyc.pan.stepDescription}
            />
            <KycPanStep
              initialDraft={journeyDraft.pan ?? bootstrap?.pan_draft ?? null}
              initiallyVerified={panVerified}
              initialKycAlreadyRegistered={bootstrap?.kyc_already_registered ?? null}
              onBlocked={handlePanBlocked}
              onPanVerified={({ readiness }) => setPanReadiness(readiness ?? null)}
              onPanReset={() => setPanReadiness(null)}
              onSubmit={handlePanSubmit}
              disabled={saving}
            />
          </div>
        );
      case "address":
        return (
          <KycAddressStep
            initialValue={journeyDraft.address ?? mapContactDraft(bootstrap?.contact_draft) ?? createEmptyAddressForm()}
            stateOptions={stateOptions}
            prefilledFromDigilocker={prefilledFromDigilocker}
            saving={saving}
            onSubmit={handleAddressSubmit}
          />
        );
      case "personal-info":
        return (
          <KycPersonalInfoStep
            initialValue={journeyDraft.personalInfo ?? mapPersonalDraft(bootstrap?.personal_draft)}
            enumOptions={enumOptions}
            nationalityOptions={nationalityOptions}
            saving={saving}
            onSubmit={handlePersonalSubmit}
          />
        );
      case "nominee":
        return (
          <KycNomineeStep
            initialNominees={journeyDraft.nominees ?? mapNomineeDraft(bootstrap?.nominee_draft)}
            relationshipOptions={nomineeEnums?.relationships}
            sourceOfWealthOptions={nomineeEnums?.source_of_wealth}
            documentTypeOptions={nomineeEnums?.document_types}
            saving={saving}
            onSubmit={handleNomineeSubmit}
          />
        );
      case "bank": {
        const mappedBank = mapBankDraft(bootstrap?.bank_draft);
        const manualRequired = bootstrap?.bank_verification_status === "manual_required";
        return (
          <KycBankStep
            initialValue={journeyDraft.bank ?? mappedBank?.form ?? createEmptyBankForm()}
            initialAccountDetails={journeyDraft.bank?.accountDetails ?? mappedBank?.accountDetails ?? null}
            initialProofUploaded={Boolean(bootstrap?.poa_bank_proof_file_id)}
            readiness={panReadiness}
            initialVerification={
              bootstrap?.bank_verification_status === "verified"
                ? {
                    panVerified: true,
                    bankVerified: true,
                    readinessVerified: mappedBank?.readinessVerified ?? false,
                    bankName: String(bootstrap?.bank_draft?.bankName ?? journeyDraft.bank?.accountDetails.bankName ?? ""),
                    branch: String(bootstrap?.bank_draft?.branch ?? journeyDraft.bank?.accountDetails.branch ?? ""),
                  }
                : manualRequired
                  ? {
                      panVerified: true,
                      bankVerified: false,
                      readinessVerified: mappedBank?.readinessVerified ?? false,
                      bankName: String(bootstrap?.bank_draft?.bankName ?? ""),
                      branch: String(bootstrap?.bank_draft?.branch ?? ""),
                      requiresManualVerification: true,
                      requiresProofUpload: true,
                      failureReason: bootstrap?.bank_verification_failure?.reason,
                    }
                  : null
            }
            saving={saving}
            onSubmit={handleBankSubmit}
          />
        );
      }
      case "signature":
        return (
          <KycSignatureStep
            onSubmit={handleSignatureSubmit}
          />
        );
      case "review":
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            {submitError ? (
              <FieldMessage message={submitError} className="mb-3 mt-0 shrink-0" />
            ) : null}
            <KycReviewStep
              draft={journeyDraft}
              requiresFullKyc={requiresFullKyc}
              onSubmit={() => void handleReviewSubmit()}
              onAddNominee={() =>
                setActiveStepIndex(journeySteps.findIndex((step) => step.id === "nominee"))
              }
              familyGroupRepromptNominee={reviewFamilyRepromptNominee}
              onFamilyGroupRepromptInvite={() => {
                if (!reviewFamilyRepromptNominee) return;
                setFamilyPromptNominee(reviewFamilyRepromptNominee);
                setFamilyReviewDialogOpen(true);
              }}
              onFamilyGroupRepromptDismiss={() => {
                if (!reviewFamilyRepromptNominee) {
                  setReviewFamilyRepromptNominee(null);
                  return;
                }
                void addNomineeToFamilyGroup({
                  nominee_email: reviewFamilyRepromptNominee.contact.email.trim(),
                  nominee_name: reviewFamilyRepromptNominee.core.fullName.trim(),
                  relationship: reviewFamilyRepromptNominee.core.relationship,
                  kyc_nominee_id: reviewFamilyRepromptNominee.id,
                  action: "skip",
                }).finally(() => {
                  setReviewFamilyRepromptNominee(null);
                });
              }}
            />
            {submitting ? (
              <p className="mt-3 shrink-0 text-center text-compact text-muted-foreground">
                {copy.kyc.review.submitting}
              </p>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="kyc-dialog-overlay"
          className={cn(
            "kyc-dialog-root kyc-dialog-surface flex w-full flex-col overflow-hidden p-0 shadow-zynd-high ring-1 ring-border",
            isOutcomeView
              ? "kyc-dialog-root--outcome max-w-[18.5rem] sm:max-w-[19.5rem]"
              : "max-h-[min(90vh,820px)] max-w-xl sm:max-w-[36rem]",
          )}
        >
          <DialogTitle className="sr-only">{copy.kyc.pageTitle}</DialogTitle>

          {isOutcomeView ? (
            <>
              <KycDialogChrome
                title={kraVerifiedOutcomeShown ? copy.kyc.completeTitle : copy.kyc.submittedTitle}
                onClose={() => onOpenChange(false)}
                showStepBadge={false}
                hideBottomBorder
                className="pb-0 [&_header]:px-5 [&_header]:py-2.5 sm:[&_header]:px-6"
              />
              <KycDialogBody variant="default" className="px-5 py-4 sm:px-6 sm:py-5">
                {kraVerifiedOutcomeShown ? (
                  <KycOutcomePanel
                    variant="success"
                    copy={{
                      description: copy.kyc.completeDescription,
                      detailLabel: copy.kyc.verifiedPanLabel,
                      detailValue: submittedPan,
                      actionLabel: copy.kyc.done,
                    }}
                    onAction={() => onOpenChange(false)}
                  />
                ) : (
                  <>
                    <KycOutcomePanel
                      variant="waiting"
                      copy={{
                        description: kraCheckMessage ?? copy.kyc.submittedDescription,
                        detailLabel: submittedPan ? copy.kyc.submittedPanLabel : undefined,
                        detailValue: submittedPan,
                        actionLabel: checkingKraStatus
                          ? copy.kyc.checkStatusChecking
                          : copy.kyc.checkStatusAction,
                      }}
                      onAction={() => void handleCheckKraStatus()}
                      secondaryActionLabel={copy.kyc.checkStatusDone}
                      onSecondaryAction={() => onOpenChange(false)}
                      actionLoading={checkingKraStatus}
                    />
                  </>
                )}
              </KycDialogBody>
            </>
          ) : !kycAllowed ? (
            <>
              <KycDialogChrome
                title={copy.kyc.pageTitle}
                onClose={() => handleOpenChange(false)}
                showStepBadge={false}
                hideBottomBorder
              />
              <KycDialogBody variant="default">
                <KycEntryGate reasons={kycBlockReasons} onReady={() => openDialog()} />
              </KycDialogBody>
            </>
          ) : (
            <>
              <KycDialogChrome
                activeStepIndex={activeStepIndex}
                steps={journeySteps}
                title={journeySteps[activeStepIndex]?.label ?? copy.kyc.pageTitle}
                onClose={() => handleOpenChange(false)}
                onBack={() => setActiveStepIndex((current) => Math.max(0, current - 1))}
                showProgress
              />
              <KycDialogBody variant={activeStepId === "review" ? "review" : "default"}>
                {journeySaveError ? (
                  <FieldMessage message={journeySaveError} className="mb-3 mt-0 shrink-0" />
                ) : null}
                {renderJourneyStep()}
              </KycDialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={exitConfirmOpen}
        onOpenChange={setExitConfirmOpen}
        variant="warning"
        title={copy.kyc.exitConfirm.title}
        description={copy.kyc.exitConfirm.description}
        confirmLabel={copy.kyc.exitConfirm.confirm}
        cancelLabel={copy.kyc.exitConfirm.cancel}
        onConfirm={() => {
          setExitConfirmOpen(false);
          onOpenChange(false);
        }}
      />

      <KycPanBlockDialog
        open={Boolean(blockDialog)}
        onOpenChange={(next) => {
          if (!next) setBlockDialog(null);
        }}
        title={blockDialog?.title ?? ""}
        description={blockDialog?.description ?? ""}
      />

      <ConfirmDialog
        open={digilockerInfoOpen}
        onOpenChange={setDigilockerInfoOpen}
        variant="warning"
        title={copy.kyc.digilocker.failedTitle}
        description={copy.kyc.digilocker.failedDescription}
        confirmLabel={copy.kyc.digilocker.retry}
        cancelLabel={copy.kyc.digilocker.cancel}
        onConfirm={() => {
          setDigilockerInfoOpen(false);
          void (async () => {
            const { redirect_url: redirectUrl } = await startKycDigilocker();
            window.location.assign(redirectUrl);
          })();
        }}
      />

      <KycLocationRequiredDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        error={locationError}
        loading={locationLoading}
        onRequestLocation={() => {
          void handleLocationRequest();
        }}
      />

      <KycEsignDialog
        open={esignDialogOpen}
        onOpenChange={setEsignDialogOpen}
        onComplete={() => {
          setEsignDialogOpen(false);
          if (pendingEsignUrl) {
            window.location.assign(pendingEsignUrl);
          }
        }}
      />

      <KycNomineeFamilyGroupDialog
        open={familyPromptOpen}
        onOpenChange={setFamilyPromptOpen}
        nominee={familyPromptNominee}
        onCompleted={handleFamilyPromptCompleted}
      />

      <KycNomineeFamilyGroupDialog
        open={familyReviewDialogOpen}
        onOpenChange={setFamilyReviewDialogOpen}
        nominee={reviewFamilyRepromptNominee}
        onCompleted={handleReviewFamilyPromptCompleted}
      />
    </>
  );
}
