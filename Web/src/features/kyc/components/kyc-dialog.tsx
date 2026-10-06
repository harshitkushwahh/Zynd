"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
import { KycDialogLayout } from "@/features/kyc/components/kyc-dialog-layout";
import { KycDialogProgressState } from "@/features/kyc/components/kyc-dialog-progress-state";
import { KycEntryGate } from "@/features/kyc/components/kyc-entry-gate";
import { KycFormHeader } from "@/features/kyc/components/kyc-form-header";
import { KycOutcomePanel } from "@/features/kyc/components/kyc-outcome-panel";
import { KycPanBlockDialog } from "@/features/kyc/components/kyc-pan-block-dialog";
import { KycPanStep } from "@/features/kyc/components/kyc-pan-step";
import { KycBankStep } from "@/features/kyc/components/kyc-bank-step";
import { KycNomineeStep } from "@/features/kyc/components/kyc-nominee-step";
import { KycNomineeOptOutDialog } from "@/features/kyc/components/kyc-nominee-opt-out-dialog";
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
import { KycDigilockerDialog } from "@/features/kyc/components/kyc-digilocker-dialog";
import { KycEsignDialog } from "@/features/kyc/components/kyc-esign-dialog";
import { KycPartnerEmbedDialog } from "@/features/kyc/components/kyc-partner-embed-dialog";
import { KycDigilockerFailureDialog } from "@/features/kyc/components/kyc-digilocker-failure-dialog";
import { KycLocationRequiredDialog } from "@/features/kyc/components/kyc-location-required-dialog";
import { KycPanReadinessBadge } from "@/features/kyc/components/kyc-pan-readiness-badge";
import { getKycStepFormMeta } from "@/features/kyc/lib/kyc-step-form-meta";
import {
  ensureKycToken,
  checkKycReadiness,
  continueKycForm,
  fetchKycBootstrap,
  fetchKycIdentityDocument,
  startKycDigilocker,
  startPoaKycForm,
  fetchKycFormStatus,
  fetchKycCountries,
  fetchKycMasterDataEnums,
  fetchKycNomineeEnums,
  fetchKycStates,
  resetKycJourneyDrafts,
  saveKycGeolocation,
  saveKycJourneyState,
  submitKycForm,
  type KycBootstrapResponse,
  type KycFormActionResponse,
  type KycNomineeEnums,
  type KycPanVerifyResponse,
} from "@/features/kyc/lib/kyc-api";
import { getKycBootstrapErrorMessage } from "@/features/kyc/lib/kyc-bootstrap-error";
import { pollWithBackoff } from "@/features/kyc/lib/kyc-polling";
import { INDIAN_STATES, mergeIndianStateOptions } from "@/features/kyc/lib/indian-states";
import {
  createEmptyBankForm,
  type KycBankFormValue,
} from "@/features/kyc/lib/kyc-bank";
import type { KycNomineeRecord } from "@/features/kyc/lib/kyc-nominee";
import {
  capReachableStepIndex,
  shouldFocusReviewAfterPartnerReturn,
  digilockerFailureDescription,
  readinessFromBootstrap,
  shouldBlockAddressStep,
  shouldShowDigilockerFailureAlert,
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
import { kycPanResetRequiresConfirm } from "@/features/kyc/lib/kyc-pan-reset";
import { resolvePanDisplay } from "@/features/kyc/lib/kyc-sensitive-display";
import { isProofDetailsComplete } from "@/features/kyc/lib/kyc-flow-mode";
import {
  getKycJourneySteps,
  requiresFullKycSubmission,
  type KycJourneyStepId,
} from "@/features/kyc/lib/kyc-journey";
import {
  createEmptyAddressForm,
  type KycAddressFormValue,
} from "@/features/kyc/lib/kyc-address";
import type { KycPersonalInfoValue } from "@/features/kyc/lib/kyc-personal-info";
import { normalizeFathersNameFromDigilocker } from "@/features/kyc/lib/kyc-name-validation";
import {
  clearDigilockerReturnHandled,
  clearPendingDigilockerResume,
  hasPendingDigilockerResume,
  markPendingDigilockerResume,
  processDigilockerReturnFromSearch,
  processDigilockerReturnFromUrl,
  resumePendingDigilockerIfNeeded,
  type DigilockerReturnResult,
} from "@/features/kyc/lib/kyc-digilocker-return";
import { isDigilockerAddressPrefillIncomplete } from "@/features/kyc/lib/kyc-digilocker-prefill";
import { processPoaProofReturnFromUrl } from "@/features/kyc/lib/kyc-poa-proof-return";
import {
  clearPendingEsignResume,
  hasPendingEsignResume,
  markEsignReturnHandledFromSearch,
  markPendingEsignResume,
  parseEsignReturnFromSearch,
  stripEsignReturnParams,
} from "@/features/kyc/lib/kyc-esign-return";
import { KycEsignIncompleteDialog } from "@/features/kyc/components/kyc-esign-incomplete-dialog";
import {
  claimKycPartnerEmbedReturn,
  isKycPartnerEmbedEnabled,
  isKycPartnerEmbedReturnMessage,
  KYC_PARTNER_RETURN_BROADCAST,
  markPoaProofReturnHandledFromSearch,
} from "@/features/kyc/lib/kyc-partner-embed";
import {
  closeKycPartnerPopup,
  navigateKycPartnerPopup,
  openKycPartnerPopup,
  type KycPartnerPopupKind,
} from "@/features/kyc/lib/kyc-partner-popup";
import { copy } from "@/shared/config/copy";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type KycDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const KYC_DIALOG_CLOSE_RESET_MS = 220;

type ApplyBootstrapOptions = {
  digilockerReturn?: DigilockerReturnResult;
  /** Keep the current journey step (e.g. after PAN verify while user confirms names). */
  preserveActiveStep?: boolean;
  /** After eSign / submission return — land on Review instead of server active_step_index. */
  focusReviewStep?: boolean;
};

function resolveApplyBootstrapOptions(
  second?: DigilockerReturnResult | ApplyBootstrapOptions,
): {
  digilockerReturn: DigilockerReturnResult;
  preserveActiveStep: boolean;
  focusReviewStep: boolean;
} {
  if (second && "kind" in second) {
    return { digilockerReturn: second, preserveActiveStep: false, focusReviewStep: false };
  }
  return {
    digilockerReturn: second?.digilockerReturn ?? { kind: "none" },
    preserveActiveStep: Boolean(second?.preserveActiveStep),
    focusReviewStep: Boolean(second?.focusReviewStep),
  };
}

function KycJourneyStepPanel({
  stepId,
  activeStepId,
  children,
}: {
  stepId: KycJourneyStepId;
  activeStepId: KycJourneyStepId | undefined;
  children: ReactNode;
}) {
  const isActive = activeStepId === stepId;
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col", !isActive && "hidden")}
      aria-hidden={!isActive}
      hidden={!isActive}
    >
      {children}
    </div>
  );
}

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
  const fathersRaw = String(raw.fathersName ?? raw.fathers_name ?? "");
  return {
    ...raw,
    fathersName: fathersRaw ? normalizeFathersNameFromDigilocker(fathersRaw) : fathersRaw,
    spouseName: String(raw.spouseName ?? raw.spouse_name ?? ""),
    maritalStatusLocked: Boolean(raw.maritalStatusLocked ?? raw.marital_status_locked),
  } as Partial<KycPersonalInfoValue>;
}

function mapNomineeDraft(raw: Record<string, unknown>[] | null | undefined): KycNomineeRecord[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw as KycNomineeRecord[];
}

function mapBankDraft(raw: Record<string, unknown> | null | undefined) {
  if (!raw) return undefined;
  const form: KycBankFormValue = {
    accountNumber: String(raw.accountNumber ?? ""),
    accountNumberMasked: String(raw.accountNumberMasked ?? ""),
    accountNumberLast4: String(raw.accountNumberLast4 ?? ""),
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
    overallStatus,
    kycAllowed,
    kycBlockReasons,
    markKycSubmitted,
    markKycVerified,
    applyReadinessCheck,
    refreshFromBootstrap,
    openDialog,
    digilockerResumeToken,
    kycSubmissionResumeToken,
    resumeAfterDigilocker,
    resumeAfterKycSubmission,
  } = useKyc();

  const [bootstrap, setBootstrap] = useState<KycBootstrapResponse | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [panResetConfirmOpen, setPanResetConfirmOpen] = useState(false);
  const [panResetConfirmLoading, setPanResetConfirmLoading] = useState(false);
  const panResetProceedRef = useRef<(() => void) | null>(null);
  const kycMasterDataLoadedRef = useRef(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [maxReachableStepIndex, setMaxReachableStepIndex] = useState(0);
  const [journeyDraft, setJourneyDraft] = useState<KycJourneyDraft>(() => createEmptyJourneyDraft());
  const [stateOptions, setStateOptions] = useState<string[]>(() => [...INDIAN_STATES]);
  const [masterEnums, setMasterEnums] = useState<Awaited<ReturnType<typeof fetchKycMasterDataEnums>> | null>(null);
  const [nationalityOptions, setNationalityOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [prefilledFromDigilocker, setPrefilledFromDigilocker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockDialog, setBlockDialog] = useState<{ title: string; description: string } | null>(null);
  const [nomineeEnums, setNomineeEnums] = useState<KycNomineeEnums | null>(null);
  const [digilockerRedirectOpen, setDigilockerRedirectOpen] = useState(false);
  const [showDigilockerFailureCard, setShowDigilockerFailureCard] = useState(false);
  const [digilockerFailureDialogOpen, setDigilockerFailureDialogOpen] = useState(false);
  const [digilockerRetrying, setDigilockerRetrying] = useState(false);
  const digilockerAddressAutoStartRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOutcomeShown, setSubmittedOutcomeShown] = useState(false);
  const [kraVerifiedOutcomeShown, setKraVerifiedOutcomeShown] = useState(false);
  const [checkingKraStatus, setCheckingKraStatus] = useState(false);
  const [kraCheckMessage, setKraCheckMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [journeySaveError, setJourneySaveError] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [panReadiness, setPanReadiness] = useState<KycReadinessInfo | null>(null);
  const [panReentryActive, setPanReentryActive] = useState(false);
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
  const [nomineeOptOutOpen, setNomineeOptOutOpen] = useState(false);
  const [nomineeOptOutDialogKey, setNomineeOptOutDialogKey] = useState(0);
  const [nomineeStepMountKey, setNomineeStepMountKey] = useState(0);
  const pendingDigilockerUrlRef = useRef<string | null>(null);
  const [digilockerRedirectVariant, setDigilockerRedirectVariant] = useState<"address" | "kraProof">(
    "address",
  );
  const [esignRedirectOpen, setEsignRedirectOpen] = useState(false);
  const [esignIncompleteOpen, setEsignIncompleteOpen] = useState(false);
  const [esignRetrying, setEsignRetrying] = useState(false);
  const pendingEsignUrlRef = useRef<string | null>(null);
  const [partnerEmbed, setPartnerEmbed] = useState<{
    kind: "digilocker" | "esign";
    url: string;
  } | null>(null);
  const [partnerPopupBlocked, setPartnerPopupBlocked] = useState(false);
  const partnerPopupRef = useRef<Window | null>(null);
  const partnerReturnHandledRef = useRef(false);
  const partnerPopupClosedHandledRef = useRef(false);

  const resetPartnerEmbedState = useCallback(() => {
    closeKycPartnerPopup(partnerPopupRef.current);
    partnerPopupRef.current = null;
    setPartnerEmbed(null);
    setPartnerPopupBlocked(false);
  }, []);

  const navigatePartnerPopup = useCallback((url: string, kind: KycPartnerPopupKind): boolean => {
    const target = url.trim();
    if (!target) return false;

    let popup = partnerPopupRef.current;
    if (!popup || popup.closed) {
      popup = openKycPartnerPopup(target, kind);
      partnerPopupRef.current = popup;
      if (!popup) {
        setPartnerPopupBlocked(true);
        return false;
      }
      setPartnerPopupBlocked(false);
      try {
        popup.focus();
      } catch {
        // ignore
      }
      return true;
    }

    const ok = navigateKycPartnerPopup(popup, target);
    if (!ok) {
      partnerPopupRef.current = null;
      popup = openKycPartnerPopup(target, kind);
      partnerPopupRef.current = popup;
      if (!popup) {
        setPartnerPopupBlocked(true);
        return false;
      }
      try {
        popup.focus();
      } catch {
        // ignore
      }
    }
    setPartnerPopupBlocked(false);
    return true;
  }, []);

  const launchKycPartnerFlow = useCallback(
    (kind: "digilocker" | "esign", redirectUrl: string) => {
      const url = redirectUrl.trim();
      if (!url) return;
      partnerReturnHandledRef.current = false;
      partnerPopupClosedHandledRef.current = false;
      setPartnerEmbed({ kind, url });
      navigatePartnerPopup(url, kind);
    },
    [navigatePartnerPopup],
  );

  const reopenKycPartnerPopup = useCallback(() => {
    const url = partnerEmbed?.url?.trim();
    const kind = partnerEmbed?.kind ?? "digilocker";
    if (!url) return;
    partnerPopupRef.current = null;
    navigatePartnerPopup(url, kind);
  }, [navigatePartnerPopup, partnerEmbed?.kind, partnerEmbed?.url]);

  const openDigilockerRedirectDialog = useCallback(
    (redirectUrl: string, variant: "address" | "kraProof" = "address") => {
      const url = redirectUrl.trim();
      pendingDigilockerUrlRef.current = url;
      setDigilockerRedirectVariant(variant);
      if (isKycPartnerEmbedEnabled()) {
        launchKycPartnerFlow("digilocker", url);
        return;
      }
      setDigilockerRedirectOpen(true);
    },
    [launchKycPartnerFlow],
  );

  const completeDigilockerRedirect = useCallback(() => {
    setDigilockerRedirectOpen(false);
    const redirectUrl = pendingDigilockerUrlRef.current;
    pendingDigilockerUrlRef.current = null;
    if (redirectUrl) {
      window.location.assign(redirectUrl);
    }
  }, []);

  const openEsignRedirectDialog = useCallback(
    (redirectUrl: string) => {
      const url = redirectUrl.trim();
      pendingEsignUrlRef.current = url;
      if (isKycPartnerEmbedEnabled()) {
        launchKycPartnerFlow("esign", url);
        return;
      }
      setEsignRedirectOpen(true);
    },
    [launchKycPartnerFlow],
  );

  const completeEsignRedirect = useCallback(() => {
    setEsignRedirectOpen(false);
    const redirectUrl = pendingEsignUrlRef.current;
    pendingEsignUrlRef.current = null;
    if (redirectUrl) {
      markPendingEsignResume(bootstrap?.external_kyc_form_id ?? null);
      window.location.assign(redirectUrl);
    }
  }, [bootstrap?.external_kyc_form_id]);

  const processSubmissionResult = useCallback(
    async (result: KycFormActionResponse) => {
      if (result.next_action === "proof_redirect" && result.redirect_url) {
        const { shouldUsePoaPartnerForm } = await import("@/features/kyc/lib/kyc-flow-mode");
        if (!shouldUsePoaPartnerForm(bootstrap)) {
          setSubmitError(result.message ?? copy.kyc.submitFailedTitle);
          return;
        }
        setSubmitError(null);
        openDigilockerRedirectDialog(result.redirect_url.trim(), "kraProof");
        return;
      }
      if (result.next_action === "esign_redirect" && result.redirect_url) {
        openEsignRedirectDialog(result.redirect_url);
        return;
      }
      if (result.next_action === "submitted") {
        clearPendingEsignResume();
        markKycSubmitted();
        setSubmittedOutcomeShown(true);
        setSubmitError(null);
        return;
      }
      if (result.next_action === "completed") {
        clearPendingEsignResume();
        markKycVerified(
          resolvePanDisplay(journeyDraft.pan ?? bootstrap?.pan_draft ?? null) ?? undefined,
        );
        setSubmittedOutcomeShown(false);
        setKraVerifiedOutcomeShown(true);
        setSubmitError(null);
        return;
      }
      if (result.next_action === "failed") {
        setSubmitError(result.failure_reason ?? result.message ?? copy.kyc.submitFailedTitle);
        return;
      }
      if (result.next_action === "ready" || result.next_action === "none") {
        setSubmitError(result.message ?? copy.kyc.submitFailedTitle);
        return;
      }
      if (result.next_action === "processing") {
        const pathAComplete =
          bootstrap?.external_kyc_status === "returned_success" &&
          Boolean(bootstrap?.external_identity_document_id?.trim());
        if (result.signature_provided && pathAComplete) {
          setSubmitError(result.message ?? copy.kyc.submitFailedTitle);
          return;
        }
        let continued = await continueKycForm();
        if (continued.next_action === "processing") {
          continued = await pollWithBackoff(
            () => fetchKycFormStatus(),
            (status) => status.next_action === "processing",
            { maxAttempts: 1, baseDelayMs: 500 },
          );
        }
        if (continued.next_action === "processing") {
          setSubmitError(continued.message ?? copy.kyc.submitFailedTitle);
          return;
        }
        await processSubmissionResult(continued);
      }
    },
    [
      markKycSubmitted,
      markKycVerified,
      bootstrap?.pan_draft,
      bootstrap?.requires_address_step_digilocker,
      bootstrap?.requires_pan_step_digilocker,
      bootstrap?.requires_digilocker,
      bootstrap?.external_kyc_status,
      bootstrap?.external_identity_document_id,
      journeyDraft.pan,
      openEsignRedirectDialog,
      openDigilockerRedirectDialog,
    ],
  );

  const retryEsignFromIncomplete = useCallback(async () => {
    setEsignRetrying(true);
    setSubmitError(null);
    try {
      const status = await fetchKycFormStatus();
      if (status.next_action === "esign_redirect" && status.redirect_url?.trim()) {
        openEsignRedirectDialog(status.redirect_url.trim());
        setEsignIncompleteOpen(false);
        return;
      }
      const continued = await continueKycForm();
      await processSubmissionResult(continued);
      setEsignIncompleteOpen(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : copy.kyc.submitFailedTitle);
    } finally {
      setEsignRetrying(false);
    }
  }, [openEsignRedirectDialog, processSubmissionResult]);

  const applyBootstrap = useCallback(
    (
      payload: KycBootstrapResponse,
      second?: DigilockerReturnResult | ApplyBootstrapOptions,
    ) => {
      const { digilockerReturn, preserveActiveStep, focusReviewStep } =
        resolveApplyBootstrapOptions(second);
      let mergedPayload = payload;

      if (digilockerReturn.kind === "failed") {
        mergedPayload = {
          ...payload,
          external_kyc_status: "returned_failed",
          digilocker_failure_reason:
            digilockerReturn.reason ??
            payload.digilocker_failure_reason ??
            copy.kyc.digilocker.failedDescription,
        };
      } else if (digilockerReturn.kind === "success") {
        mergedPayload = {
          ...payload,
          external_kyc_status: "returned_success",
          digilocker_failure_reason: null,
          contact_draft: digilockerReturn.contactDraft ?? payload.contact_draft,
          personal_draft: digilockerReturn.personalDraft ?? payload.personal_draft,
        };
      }

      setBootstrap(mergedPayload);
      const fullKycRequired = requiresFullKycSubmission({
        kyc_already_registered: mergedPayload.kyc_already_registered,
        readiness_code: mergedPayload.readiness_code,
        poa_readiness_preverify_id: mergedPayload.poa_readiness_preverify_id,
      });
      const steps = getKycJourneySteps(fullKycRequired);
      const stepIndex = Math.min(mergedPayload.active_step_index ?? 0, steps.length - 1);
      const reachableIndex = capReachableStepIndex(stepIndex, steps, mergedPayload);
      const panStepIndex = steps.findIndex((step) => step.id === "pan-card");
      const addressStepIndex = steps.findIndex((step) => step.id === "address");
      const showFailureAlert = shouldShowDigilockerFailureAlert(
        mergedPayload,
        digilockerReturn.kind === "failed",
      );

      const reviewIndex = steps.findIndex((step) => step.id === "review");

      if (preserveActiveStep && digilockerReturn.kind === "none") {
        setMaxReachableStepIndex((prev) => Math.max(prev, reachableIndex));
      } else if (digilockerReturn.kind === "success" && addressStepIndex >= 0) {
        setActiveStepIndex(addressStepIndex);
        setMaxReachableStepIndex(Math.max(reachableIndex, addressStepIndex));
      } else if (
        (showFailureAlert || digilockerReturn.kind === "failed") &&
        addressStepIndex >= 0
      ) {
        setActiveStepIndex(addressStepIndex);
        setMaxReachableStepIndex(addressStepIndex);
      } else if (showFailureAlert && panStepIndex >= 0) {
        setActiveStepIndex(panStepIndex);
        setMaxReachableStepIndex(Math.min(reachableIndex, panStepIndex));
      } else {
        setActiveStepIndex(Math.min(stepIndex, reachableIndex));
        setMaxReachableStepIndex(reachableIndex);
      }

      if (focusReviewStep && digilockerReturn.kind === "none" && reviewIndex >= 0) {
        setActiveStepIndex(reviewIndex);
        setMaxReachableStepIndex((prev) => Math.max(prev, reachableIndex, reviewIndex));
      }

      const signatureDraft = mergedPayload.signature_draft as KycSignatureDraft | null | undefined;
      const mappedAddress = mapContactDraft(mergedPayload.contact_draft);
      const mappedPersonal = mapPersonalDraft(mergedPayload.personal_draft) as KycPersonalInfoValue | undefined;

      setJourneyDraft({
        pan: mergedPayload.pan_draft ?? undefined,
        address: mappedAddress,
        personalInfo: mappedPersonal,
        nominees: mapNomineeDraft(mergedPayload.nominee_draft),
        nominationOptedOut: Boolean(mergedPayload.nomination_opted_out),
        bank: (() => {
          const mapped = mapBankDraft(mergedPayload.bank_draft);
          if (!mapped?.form || !mapped.accountDetails) return undefined;
          return { ...mapped.form, accountDetails: mapped.accountDetails };
        })(),
        signature: signatureDraft ?? undefined,
      });
      setSubmittedOutcomeShown(mergedPayload.step_statuses?.overall === "submitted");
      setKraVerifiedOutcomeShown(mergedPayload.step_statuses?.overall === "completed");
      setKraCheckMessage(null);
      setPanReadiness(readinessFromBootstrap(mergedPayload));
      const identityPrefill = Boolean(
        mergedPayload.contact_draft &&
          requiresFullKycSubmission({
            kyc_already_registered: mergedPayload.kyc_already_registered,
            readiness_code: mergedPayload.readiness_code,
            poa_readiness_preverify_id: mergedPayload.poa_readiness_preverify_id,
          }) &&
          mergedPayload.external_kyc_status === "returned_success" &&
          !mergedPayload.requires_address_step_proof_digilocker,
      );
      const proofPrefill = Boolean(
        mergedPayload.requires_address_step_proof_digilocker &&
          isProofDetailsComplete(mergedPayload.proof_details_status) &&
          mergedPayload.contact_draft,
      );
      setPrefilledFromDigilocker(identityPrefill || proofPrefill);
      setShowDigilockerFailureCard(showFailureAlert);
      if (digilockerReturn.kind === "failed") {
        digilockerAddressAutoStartRef.current = true;
        setDigilockerFailureDialogOpen(true);
      }
    },
    [],
  );

  const completeDigilockerInline = useCallback(
    async (identityDocumentId?: string | null) => {
      const documentId =
        identityDocumentId?.trim() ||
        (typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("identity_document")
          : null);
      if (documentId) {
        const result = await fetchKycIdentityDocument(documentId);
        const payload = await fetchKycBootstrap();
        if (result.success) {
          applyBootstrap(payload, {
            kind: "success",
            contactDraft: result.contact_draft ?? null,
            personalDraft: result.personal_draft ?? null,
          });
        } else {
          applyBootstrap(payload, {
            kind: "failed",
            reason: result.reason?.trim() || copy.kyc.digilocker.failedDescription,
          });
        }
      } else {
        const payload = await fetchKycBootstrap();
        applyBootstrap(payload);
      }
      clearPendingDigilockerResume();
    },
    [applyBootstrap],
  );

  const beginDigilockerRedirect = useCallback(async (): Promise<"redirect" | "inline"> => {
    clearDigilockerReturnHandled();
    const {
      redirect_url: redirectUrl,
      inline_complete: inlineComplete,
      identity_document_id: identityDocumentId,
    } = await startKycDigilocker();
    if (inlineComplete) {
      await completeDigilockerInline(identityDocumentId);
      return "inline";
    }
    if (!redirectUrl.trim()) {
      throw new Error(copy.kyc.digilocker.failedDescription);
    }
    markPendingDigilockerResume(identityDocumentId);
    openDigilockerRedirectDialog(redirectUrl);
    return "redirect";
  }, [completeDigilockerInline, openDigilockerRedirectDialog]);

  const beginProofDigilockerRedirect = useCallback(async () => {
    const status = await startPoaKycForm();
    const fetchUrl = status.proof_fetch_url?.trim() ?? "";
    if (status.needs_digilocker && fetchUrl) {
      openDigilockerRedirectDialog(fetchUrl, "kraProof");
      return;
    }
    if (status.needs_digilocker && !fetchUrl) {
      throw new Error(copy.kyc.digilocker.failedDescription);
    }
    const payload = await fetchKycBootstrap();
    applyBootstrap(payload);
  }, [applyBootstrap, openDigilockerRedirectDialog]);

  const handleDigilockerRetry = useCallback(async () => {
    digilockerAddressAutoStartRef.current = false;
    setDigilockerRetrying(true);
    try {
      setDigilockerFailureDialogOpen(false);
      setShowDigilockerFailureCard(false);
      setJourneySaveError(null);
      if (bootstrap?.requires_address_step_proof_digilocker) {
        await beginProofDigilockerRedirect();
      } else {
        await beginDigilockerRedirect();
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : copy.kyc.digilocker.failedDescription;
      setJourneySaveError(message);
      setShowDigilockerFailureCard(true);
      setDigilockerFailureDialogOpen(true);
    } finally {
      setDigilockerRetrying(false);
    }
  }, [beginDigilockerRedirect, beginProofDigilockerRedirect, bootstrap?.requires_address_step_proof_digilocker]);

  const handleCheckKraStatus = useCallback(async () => {
    setCheckingKraStatus(true);
    setKraCheckMessage(null);
    try {
      const result = await checkKycReadiness({ forceRefresh: true });
      applyReadinessCheck(result);
      const payload = await fetchKycBootstrap();
      applyBootstrap(payload);
      await refreshFromBootstrap();
      if (result.kra_verified) {
        markKycVerified(resolvePanDisplay(bootstrap?.pan_draft ?? null) ?? undefined);
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
    bootstrap?.pan_draft,
    markKycVerified,
    refreshFromBootstrap,
  ]);

  const loadBootstrap = useCallback(async () => {
    setLoadingBootstrap(true);
    setBootstrapError(null);
    try {
      await ensureKycToken();

      await processPoaProofReturnFromUrl();

      const urlParams =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const freshDigilockerReturn = Boolean(
        urlParams &&
          (urlParams.get("kyc_digilocker_return") === "1" ||
            (urlParams.get("identity_document") && urlParams.get("status"))),
      );

      let digilockerReturn: DigilockerReturnResult = { kind: "none" };
      if (freshDigilockerReturn) {
        digilockerReturn = await processDigilockerReturnFromUrl();
      }

      let payload = await fetchKycBootstrap();

      if (digilockerReturn.kind === "success") {
        clearPendingDigilockerResume();
        payload = await fetchKycBootstrap();
      } else if (payload.external_kyc_status !== "returned_success") {
        digilockerReturn = await resumePendingDigilockerIfNeeded();
        if (digilockerReturn.kind === "success") {
          payload = await fetchKycBootstrap();
        }
      } else {
        clearPendingDigilockerResume();
      }

      const esignReturn = parseEsignReturnFromSearch();
      const pendingEsignResume = hasPendingEsignResume();
      const digilockerReturnActive =
        freshDigilockerReturn || digilockerReturn.kind !== "none";
      if (digilockerReturnActive) {
        clearPendingEsignResume();
      }
      const focusReviewStep =
        !digilockerReturnActive &&
        shouldFocusReviewAfterPartnerReturn(payload, {
          esignReturnActive: esignReturn.kind !== "none",
          pendingEsignResume: digilockerReturnActive ? false : pendingEsignResume,
        });
      if (pendingEsignResume && !focusReviewStep && shouldBlockAddressStep(payload)) {
        clearPendingEsignResume();
      }
      applyBootstrap(payload, {
        digilockerReturn,
        preserveActiveStep:
          digilockerReturn.kind !== "none" ||
          esignReturn.kind !== "none" ||
          pendingEsignResume,
        focusReviewStep,
      });

      if (!kycMasterDataLoadedRef.current) {
        const [statesResult, countriesResult, enumsResult] = await Promise.allSettled([
          fetchKycStates(),
          fetchKycCountries(),
          fetchKycMasterDataEnums(),
        ]);

        if (statesResult.status === "fulfilled") {
          const names = statesResult.value
            .map((item) => item.name)
            .filter((name): name is string => Boolean(name));
          setStateOptions(mergeIndianStateOptions(names));
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
          kycMasterDataLoadedRef.current = true;
        } else {
          throw enumsResult.reason;
        }

        if (payload.personal_draft) {
          try {
            const nomineeData = await fetchKycNomineeEnums();
            setNomineeEnums(nomineeData);
          } catch {
            // Nominee enum prefetch is optional during bootstrap.
          }
        }
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
    if (open) return;

    const timeoutId = window.setTimeout(() => {
      setActiveStepIndex(0);
      setMaxReachableStepIndex(0);
      setJourneyDraft(createEmptyJourneyDraft());
      setBootstrap(null);
      setPrefilledFromDigilocker(false);
      setBlockDialog(null);
      setSubmittedOutcomeShown(false);
      setKraVerifiedOutcomeShown(false);
      setKraCheckMessage(null);
      setCheckingKraStatus(false);
      setSubmitError(null);
      setPanReadiness(null);
      setPanReentryActive(false);
      setShowDigilockerFailureCard(false);
      setDigilockerFailureDialogOpen(false);
      setDigilockerRetrying(false);
      closeKycPartnerPopup(partnerPopupRef.current);
      partnerPopupRef.current = null;
      setPartnerEmbed(null);
      setPartnerPopupBlocked(false);
      setNomineeEnums(null);
      setFamilyPromptQueue([]);
      setFamilyPromptOpen(false);
      setFamilyPromptNominee(null);
      setFamilyPromptSkippedIds([]);
      setReviewFamilyRepromptNominee(null);
      setReviewFamilyRepromptChecked(false);
      setFamilyReviewDialogOpen(false);
    }, KYC_DIALOG_CLOSE_RESET_MS);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const isOutcomeView =
    kraVerifiedOutcomeShown ||
    (open && status === "complete") ||
    submittedOutcomeShown ||
    (open && overallStatus === "submitted" && status !== "complete");

  /** Keep the journey shell while the eSign companion finishes submit — avoids layout flash. */
  const shellOutcomeView = isOutcomeView && !partnerEmbed;

  const requiresExitConfirm =
    (status === "none" || status === "pending") && !isOutcomeView;

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

  const syncKycRegistrationFromPan = useCallback(
    (info: {
      kycAlreadyRegistered: boolean;
      readiness?: { status?: string; code?: string; reason?: string } | null;
      panVerified?: boolean;
    }) => {
      setBootstrap((current) => {
        if (!current) return current;
        return {
          ...current,
          kyc_already_registered: info.kycAlreadyRegistered,
          readiness_code: info.readiness?.code ?? current.readiness_code,
          readiness_reason: info.readiness?.reason ?? current.readiness_reason,
          pan_verification_status:
            info.panVerified === true ? "verified" : current.pan_verification_status,
        };
      });
    },
    [],
  );

  const requiresFullKyc = requiresFullKycSubmission({
    kyc_already_registered: bootstrap?.kyc_already_registered,
    readiness_code: bootstrap?.readiness_code,
    poa_readiness_preverify_id: bootstrap?.poa_readiness_preverify_id,
  });
  const journeySteps = useMemo(() => getKycJourneySteps(requiresFullKyc), [requiresFullKyc]);

  const focusReviewStep = useCallback(() => {
    const reviewIndex = journeySteps.findIndex((step) => step.id === "review");
    if (reviewIndex >= 0) {
      setActiveStepIndex(reviewIndex);
      setMaxReachableStepIndex((current) => Math.max(current, reviewIndex));
    }
  }, [journeySteps]);

  const resumeSubmissionReturn = useCallback(async () => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const digilockerReturnInUrl =
      params.get("kyc_digilocker_return") === "1" ||
      Boolean(params.get("identity_document") && params.get("status"));
    if (digilockerReturnInUrl || hasPendingDigilockerResume()) {
      return;
    }

    const proofReturn =
      params.get("poa_proof_return") === "1" || params.get("kyc_proof_return") === "1";
    const esignParsed = parseEsignReturnFromSearch();

    if (esignParsed.kind !== "none") {
      markEsignReturnHandledFromSearch();
    }
    if (proofReturn) {
      markPoaProofReturnHandledFromSearch();
    }

    if (!proofReturn && esignParsed.kind === "none") {
      return;
    }

    const callbackStatus = (params.get("status") ?? "").toLowerCase();
    params.delete("poa_proof_return");
    params.delete("kyc_proof_return");
    stripEsignReturnParams(params);
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    if (esignParsed.kind === "incomplete") {
      focusReviewStep();
      setEsignIncompleteOpen(true);
      setSubmitError(null);
      return;
    }

    if (proofReturn && callbackStatus !== "successful" && callbackStatus !== "success") {
      focusReviewStep();
      setSubmitError(copy.kyc.kraProof.description);
      return;
    }

    if (esignParsed.kind === "success" || proofReturn) {
      clearPendingEsignResume();
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
  }, [focusReviewStep, processSubmissionResult]);

  const applyDigilockerPartnerPopupSuccess = useCallback(
    async (result: Extract<DigilockerReturnResult, { kind: "success" }>) => {
      partnerReturnHandledRef.current = true;
      closeKycPartnerPopup(partnerPopupRef.current);
      partnerPopupRef.current = null;
      setPartnerEmbed(null);
      setPartnerPopupBlocked(false);
      pendingDigilockerUrlRef.current = null;
      try {
        const payload = await fetchKycBootstrap();
        applyBootstrap(payload, { digilockerReturn: result });
      } catch {
        // Bootstrap refresh is best-effort after popup return.
      }
      clearPendingDigilockerResume();
    },
    [applyBootstrap],
  );

  const recoverDigilockerPartnerPopupReturn = useCallback(async (): Promise<boolean> => {
    if (partnerReturnHandledRef.current) return true;
    const result = await resumePendingDigilockerIfNeeded();
    if (result.kind === "success") {
      await applyDigilockerPartnerPopupSuccess(result);
      return true;
    }
    return false;
  }, [applyDigilockerPartnerPopupSuccess]);

  const showPartnerEmbedAbandoned = useCallback(
    (kind: "digilocker" | "esign") => {
      resetPartnerEmbedState();
      pendingDigilockerUrlRef.current = null;
      pendingEsignUrlRef.current = null;
      if (kind === "digilocker") {
        setShowDigilockerFailureCard(true);
        setDigilockerFailureDialogOpen(true);
        return;
      }
      focusReviewStep();
      setEsignIncompleteOpen(true);
    },
    [focusReviewStep, resetPartnerEmbedState],
  );

  const handlePartnerEmbedReturn = useCallback(
    async (search: string) => {
      if (!claimKycPartnerEmbedReturn(search)) return;
      partnerReturnHandledRef.current = true;

      const query = search.startsWith("?") ? search : search ? `?${search}` : "";
      const params = new URLSearchParams(query.replace(/^\?/, ""));

      if (params.get("identity_document") || params.get("kyc_digilocker_return") === "1") {
        if (!open) {
          resumeAfterDigilocker();
        }
        closeKycPartnerPopup(partnerPopupRef.current);
        partnerPopupRef.current = null;
        setPartnerEmbed(null);
        setPartnerPopupBlocked(false);
        pendingDigilockerUrlRef.current = null;
        const digilockerReturn = await processDigilockerReturnFromSearch(query, {
          skipUrlCleanup: true,
        });
        try {
          const payload = await fetchKycBootstrap();
          applyBootstrap(payload, digilockerReturn);
        } catch {
          // Bootstrap refresh is best-effort after popup return.
        }
        clearPendingDigilockerResume();
        return;
      }

      if (
        params.get("kyc_esign_return") === "1" ||
        params.get("poa_proof_return") === "1" ||
        params.get("kyc_proof_return") === "1"
      ) {
        if (!open) {
          resumeAfterKycSubmission();
        }
        closeKycPartnerPopup(partnerPopupRef.current);
        partnerPopupRef.current = null;
        pendingEsignUrlRef.current = null;
        const esignParsed = parseEsignReturnFromSearch(query);
        const proofReturn =
          params.get("poa_proof_return") === "1" || params.get("kyc_proof_return") === "1";
        const callbackStatus = (params.get("status") ?? "").toLowerCase();

        if (esignParsed.kind === "incomplete") {
          setPartnerEmbed(null);
          setPartnerPopupBlocked(false);
          focusReviewStep();
          setEsignIncompleteOpen(true);
          setSubmitError(null);
          return;
        }

        if (proofReturn) {
          const payload = await fetchKycBootstrap().catch(() => null);
          const reviewReady =
            payload?.last_completed_step === "signature" || payload?.last_completed_step === "review";
          const proofAtAddress = Boolean(payload?.requires_address_step_proof_digilocker) && !reviewReady;
          if (proofAtAddress) {
            if (payload) applyBootstrap(payload);
            setPartnerEmbed(null);
            setPartnerPopupBlocked(false);
            if (callbackStatus !== "successful" && callbackStatus !== "success") {
              setShowDigilockerFailureCard(true);
              setDigilockerFailureDialogOpen(true);
            } else {
              setSubmitError(null);
            }
            return;
          }
        }

        if (proofReturn && callbackStatus !== "successful" && callbackStatus !== "success") {
          setPartnerEmbed(null);
          setPartnerPopupBlocked(false);
          focusReviewStep();
          setSubmitError(copy.kyc.kraProof.description);
          return;
        }

        if (esignParsed.kind === "success" || proofReturn) {
          clearPendingEsignResume();
        }

        setSubmitting(true);
        try {
          const result = await continueKycForm();
          await processSubmissionResult(result);
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : copy.kyc.submitFailedTitle);
        } finally {
          setSubmitting(false);
          setPartnerEmbed(null);
          setPartnerPopupBlocked(false);
        }
      }
    },
    [
      applyBootstrap,
      focusReviewStep,
      open,
      processSubmissionResult,
      resumeAfterDigilocker,
      resumeAfterKycSubmission,
    ],
  );

  const handlePartnerEmbedClose = useCallback(() => {
    const kind = partnerEmbed?.kind ?? "digilocker";
    void (async () => {
      if (partnerReturnHandledRef.current) {
        resetPartnerEmbedState();
        return;
      }
      if (kind === "digilocker" && (await recoverDigilockerPartnerPopupReturn())) {
        return;
      }
      showPartnerEmbedAbandoned(kind);
    })();
  }, [partnerEmbed?.kind, recoverDigilockerPartnerPopupReturn, resetPartnerEmbedState, showPartnerEmbedAbandoned]);

  const openPartnerEmbedFullWindow = useCallback(() => {
    const kind = partnerEmbed?.kind;
    const url =
      partnerEmbed?.url?.trim() ||
      pendingDigilockerUrlRef.current?.trim() ||
      pendingEsignUrlRef.current?.trim() ||
      "";
    resetPartnerEmbedState();
    pendingDigilockerUrlRef.current = null;
    pendingEsignUrlRef.current = null;
    if (!url) return;
    if (kind === "esign") {
      markPendingEsignResume(bootstrap?.external_kyc_form_id ?? null);
    }
    window.location.assign(url);
  }, [bootstrap?.external_kyc_form_id, partnerEmbed?.kind, partnerEmbed?.url, resetPartnerEmbedState]);

  useEffect(() => {
    const ingestPartnerEmbedReturn = (search: string, pathname: string) => {
      if (!pathname.includes("/embed-return")) return;
      void handlePartnerEmbedReturn(search);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isKycPartnerEmbedReturnMessage(event.data)) return;
      ingestPartnerEmbedReturn(event.data.search, event.data.pathname);
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(KYC_PARTNER_RETURN_BROADCAST);
      channel.onmessage = (event: MessageEvent) => {
        if (!isKycPartnerEmbedReturnMessage(event.data)) return;
        ingestPartnerEmbedReturn(event.data.search, event.data.pathname);
      };
    } catch {
      // BroadcastChannel unavailable.
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      channel?.close();
    };
  }, [handlePartnerEmbedReturn]);

  useEffect(() => {
    if (!partnerEmbed) return;

    const onFocus = () => {
      if (partnerEmbed.kind === "digilocker") {
        void recoverDigilockerPartnerPopupReturn();
      }
    };

    const intervalId = window.setInterval(() => {
      if (partnerReturnHandledRef.current) return;
      if (partnerPopupClosedHandledRef.current) return;
      if (partnerPopupBlocked) return;

      const popup = partnerPopupRef.current;
      if (!popup) return;
      if (!popup.closed) return;

      void (async () => {
        if (partnerEmbed.kind === "digilocker") {
          if (await recoverDigilockerPartnerPopupReturn()) {
            partnerPopupClosedHandledRef.current = true;
            return;
          }
          if (partnerReturnHandledRef.current) return;
          partnerPopupClosedHandledRef.current = true;
          showPartnerEmbedAbandoned("digilocker");
          return;
        }

        if (partnerReturnHandledRef.current) return;
        partnerPopupClosedHandledRef.current = true;
        showPartnerEmbedAbandoned(partnerEmbed.kind);
      })();
    }, 700);

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [partnerEmbed, recoverDigilockerPartnerPopupReturn, showPartnerEmbedAbandoned]);

  useEffect(() => {
    if (!open || loadingBootstrap) return;
    void resumeSubmissionReturn();
  }, [open, loadingBootstrap, resumeSubmissionReturn, kycSubmissionResumeToken]);

  useEffect(() => {
    if (!open) return;

    const onPageShow = (event: PageTransitionEvent) => {
      if (hasPendingDigilockerResume()) return;
      const esignReturn = parseEsignReturnFromSearch();
      if (esignReturn.kind === "success") return;
      if (bootstrap?.step_statuses?.overall === "submitted") return;
      if (bootstrap && shouldBlockAddressStep(bootstrap)) return;
      if (!event.persisted && !hasPendingEsignResume()) return;
      focusReviewStep();
      setEsignIncompleteOpen(true);
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [open, focusReviewStep, bootstrap?.step_statuses?.overall]);

  useEffect(() => {
    const maxIndex = Math.max(0, journeySteps.length - 1);
    setActiveStepIndex((current) => Math.min(current, maxIndex));
    setMaxReachableStepIndex((current) => Math.min(current, maxIndex));
  }, [journeySteps.length]);

  const goToNextStep = () => {
    setActiveStepIndex((current) => {
      const next = Math.min(current + 1, journeySteps.length - 1);
      setMaxReachableStepIndex((prev) => Math.max(prev, next));
      return next;
    });
  };

  const handleStepSelect = useCallback(
    (index: number) => {
      if (index > maxReachableStepIndex) return;
      const targetStepId = journeySteps[index]?.id;
      if (
        targetStepId === "address" &&
        bootstrap &&
        shouldBlockAddressStep(bootstrap)
      ) {
        setActiveStepIndex(index);
        setJourneySaveError(null);
        return;
      }
      setActiveStepIndex((current) => (index === current ? current : index));
      setJourneySaveError(null);
    },
    [bootstrap, journeySteps, maxReachableStepIndex],
  );

  const advanceFamilyPromptQueue = useCallback(() => {
    setFamilyPromptQueue((remaining) => {
      if (remaining.length === 0) {
        setFamilyPromptOpen(false);
        setFamilyPromptNominee(null);
        setActiveStepIndex((current) => {
          const next = Math.min(current + 1, journeySteps.length - 1);
          setMaxReachableStepIndex((prev) => Math.max(prev, next));
          return next;
        });
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
    panNumber?: string;
    panMasked?: string;
    panLast4?: string;
    firstName: string;
    lastName: string;
    middleName: string;
    dateOfBirth?: string;
    panCategory?: string;
    fullName?: string;
    requiresDigilocker: boolean;
    kycAlreadyRegistered: boolean;
  }) => {
    setSaving(true);
    try {
      await saveKycJourneyState({
        last_completed_step: "pan",
      });
      updateDraft({
        pan: {
          panNumber: details.panNumber || journeyDraft.pan?.panNumber,
          panMasked: details.panMasked ?? journeyDraft.pan?.panMasked,
          panLast4: details.panLast4 ?? journeyDraft.pan?.panLast4,
          firstName: details.firstName,
          lastName: details.lastName,
          middleName: details.middleName,
          dateOfBirth: details.dateOfBirth,
          panCategory: details.panCategory,
          fullName: details.fullName,
        },
      });
      syncKycRegistrationFromPan({
        kycAlreadyRegistered: details.kycAlreadyRegistered,
        readiness: panReadiness
          ? {
              status: panReadiness.status,
              code: panReadiness.code ?? undefined,
              reason: panReadiness.reason ?? undefined,
            }
          : undefined,
      });

      setPrefilledFromDigilocker(false);
      setShowDigilockerFailureCard(false);
      goToNextStep();
    } finally {
      setSaving(false);
    }
  };

  const handleAddressSubmit = async (value: KycAddressFormValue) => {
    if (bootstrap && shouldBlockAddressStep(bootstrap)) {
      setJourneySaveError(copy.kyc.digilocker.failedDescription);
      return;
    }
    setSaving(true);
    setJourneySaveError(null);
    try {
      if (bootstrap?.requires_address_step_proof_digilocker) {
        const started = await startPoaKycForm();
        if (started.needs_digilocker) {
          await beginProofDigilockerRedirect();
          return;
        }
        const payload = await fetchKycBootstrap();
        applyBootstrap(payload, { preserveActiveStep: true });
        const source =
          payload.contact_draft && typeof payload.contact_draft === "object"
            ? String((payload.contact_draft as { source?: string }).source ?? "")
            : "";
        if (source !== "proof_details") {
          setJourneySaveError(copy.kyc.address.manualEntryBlocked);
          return;
        }
        const draft = mapContactDraft(payload.contact_draft) ?? value;
        await saveKycJourneyState({
          contact_draft_json: payload.contact_draft ?? undefined,
          last_completed_step: "address",
        });
        updateDraft({ address: draft });
        goToNextStep();
        return;
      }
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

  const handleNomineeSubmit = async (
    nominees: KycNomineeRecord[],
    options?: { recordNominationOptOut?: boolean },
  ) => {
    setSaving(true);
    setJourneySaveError(null);
    try {
      await saveKycJourneyState({
        nominee_draft_json: nominees as unknown as Record<string, unknown>[],
        last_completed_step: "nominee",
        ...(options?.recordNominationOptOut ? { record_nomination_opt_out: true } : {}),
        ...(nominees.length > 0 ? { revoke_nomination_opt_out: true } : {}),
      });
      updateDraft({
        nominees,
        nominationOptedOut: options?.recordNominationOptOut
          ? true
          : nominees.length > 0
            ? false
            : journeyDraft.nominationOptedOut,
      });

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
      const bankDraft: Record<string, unknown> = {
        ...value,
        accountHolderName: value.accountDetails.accountHolderName,
        bankName: value.accountDetails.bankName,
        branch: value.accountDetails.branch,
        verificationStatus: "verified",
      };
      if (!String(bankDraft.accountNumber ?? "").trim() && (value.accountNumberLast4 || value.accountNumberMasked)) {
        delete bankDraft.accountNumber;
      }
      await saveKycJourneyState({
        bank_draft_json: bankDraft,
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
    await saveKycGeolocation(coords);
    const result = await submitKycForm({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_meters: coords.accuracy,
    });
    await processSubmissionResult(result);
  };

  const acquireKycSubmitGeolocation = async (): Promise<KycGeolocationResult | null> => {
    try {
      const coords = await requestKycGeolocation();
      await saveKycGeolocation(coords);
      return coords;
    } catch (error) {
      setLocationError(
        error instanceof KycGeolocationError ? error.message : copy.kyc.location.required,
      );
      setLocationDialogOpen(true);
      return null;
    }
  };

  const runPoaPartnerGate = async () => {
    const { ensurePoaPartnerProofReadyForSubmit } = await import(
      "@/features/kyc/lib/kyc-poa-review-pipeline"
    );
    const poaGate = await ensurePoaPartnerProofReadyForSubmit(bootstrap);
    if (poaGate.kind === "blocked") {
      setSubmitError(poaGate.message);
      return { blocked: true as const };
    }
    return { blocked: false as const };
  };

  const handleLocationRequest = async () => {
    setSubmitting(true);
    setLocationLoading(true);
    setLocationError(null);
    setSubmitError(null);
    try {
      const coords = await acquireKycSubmitGeolocation();
      if (!coords) {
        return;
      }
      setLocationDialogOpen(false);
      const gate = await runPoaPartnerGate();
      if (gate.blocked) {
        return;
      }
      await submitKycWithLocation(coords);
    } catch (error) {
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

    setSubmitting(true);
    try {
      const coords = await acquireKycSubmitGeolocation();
      if (!coords) {
        return;
      }

      const gate = await runPoaPartnerGate();
      if (gate.blocked) {
        return;
      }

      await submitKycWithLocation(coords);
    } catch (error) {
      if (error instanceof ApiError && error.code.startsWith("location_")) {
        setLocationError(error.message);
        setLocationDialogOpen(true);
        return;
      }
      setSubmitError(error instanceof Error ? error.message : copy.kyc.submitFailedTitle);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setNomineeOptOutOpen(false);
    }
  }, [open]);

  const activeStepId = journeySteps[activeStepIndex]?.id;
  const showVerifiedOutcome =
    kraVerifiedOutcomeShown || (open && status === "complete");
  const showSubmittedOutcome =
    submittedOutcomeShown ||
    (open && overallStatus === "submitted" && status !== "complete");
  const panVerified =
    bootstrap?.pan_verification_status === "verified" ||
    Boolean(
      (journeyDraft.pan?.panNumber || journeyDraft.pan?.panMasked) &&
        journeyDraft.pan?.firstName?.trim(),
    );
  const panStepIndex = useMemo(
    () => journeySteps.findIndex((step) => step.id === "pan-card"),
    [journeySteps],
  );
  const panResetRequiresConfirm = useMemo(
    () =>
      kycPanResetRequiresConfirm(bootstrap, journeyDraft, {
        panStepIndex: panStepIndex >= 0 ? panStepIndex : 0,
        maxReachableStepIndex,
      }),
    [bootstrap, journeyDraft, maxReachableStepIndex, panStepIndex],
  );
  const handleRequestPanResetConfirm = useCallback((proceed: () => void) => {
    panResetProceedRef.current = proceed;
    setPanResetConfirmOpen(true);
  }, []);
  const handleConfirmPanReset = useCallback(async () => {
    setPanResetConfirmLoading(true);
    try {
      await resetKycJourneyDrafts();
      const payload = await fetchKycBootstrap();
      applyBootstrap(payload);
      await refreshFromBootstrap();
      setPanReentryActive(true);
      setPanReadiness(null);
      setPrefilledFromDigilocker(false);
      setShowDigilockerFailureCard(false);
      setPanResetConfirmOpen(false);
      const proceed = panResetProceedRef.current;
      panResetProceedRef.current = null;
      proceed?.();
    } catch (error) {
      setJourneySaveError(error instanceof Error ? error.message : copy.kyc.journeySaveFailed);
    } finally {
      setPanResetConfirmLoading(false);
    }
  }, [applyBootstrap, refreshFromBootstrap]);
  const digilockerBlocked = shouldBlockAddressStep(bootstrap);
  const digilockerAlertVisible = useMemo(
    () => shouldShowDigilockerFailureAlert(bootstrap, showDigilockerFailureCard),
    [bootstrap, showDigilockerFailureCard],
  );
  const digilockerAlertDescription =
    digilockerFailureDescription(bootstrap) ?? copy.kyc.digilocker.failedDescription;
  const currentAddressDraft =
    journeyDraft.address ?? mapContactDraft(bootstrap?.contact_draft) ?? undefined;
  const currentPersonalDraft =
    journeyDraft.personalInfo ?? mapPersonalDraft(bootstrap?.personal_draft) ?? undefined;
  const digilockerPrefillIncomplete = useMemo(
    () => prefilledFromDigilocker && isDigilockerAddressPrefillIncomplete(currentAddressDraft),
    [currentAddressDraft, prefilledFromDigilocker],
  );
  const fathersNameFromDigilocker = useMemo(
    () => prefilledFromDigilocker && Boolean(currentPersonalDraft?.fathersName?.trim()),
    [currentPersonalDraft?.fathersName, prefilledFromDigilocker],
  );

  useEffect(() => {
    if (activeStepId !== "address") {
      digilockerAddressAutoStartRef.current = false;
    }
  }, [activeStepId]);

  useEffect(() => {
    if (!open) {
      digilockerAddressAutoStartRef.current = false;
      return;
    }
    if (loadingBootstrap || bootstrap === null) return;
    if (activeStepId !== "address" || !digilockerBlocked) return;
    if (digilockerRedirectOpen || digilockerRetrying || partnerEmbed) return;
    if (digilockerFailureDialogOpen) return;
    if (digilockerAddressAutoStartRef.current) return;
    digilockerAddressAutoStartRef.current = true;
    void (async () => {
      setDigilockerRetrying(true);
      try {
        setShowDigilockerFailureCard(false);
        setDigilockerFailureDialogOpen(false);
        setJourneySaveError(null);
        if (bootstrap?.requires_address_step_proof_digilocker) {
          await beginProofDigilockerRedirect();
        } else {
          await beginDigilockerRedirect();
        }
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : copy.kyc.digilocker.failedDescription;
        setJourneySaveError(message);
        setShowDigilockerFailureCard(true);
        setDigilockerFailureDialogOpen(true);
      } finally {
        setDigilockerRetrying(false);
      }
    })();
  }, [
    activeStepId,
    beginDigilockerRedirect,
    beginProofDigilockerRedirect,
    bootstrap?.requires_address_step_proof_digilocker,
    bootstrap === null,
    digilockerBlocked,
    digilockerFailureDialogOpen,
    digilockerRedirectOpen,
    digilockerRetrying,
    loadingBootstrap,
    open,
    partnerEmbed,
  ]);

  const journeyStepIds = useMemo(() => new Set(journeySteps.map((step) => step.id)), [journeySteps]);
  const submittedPan =
    resolvePanDisplay(bootstrap?.pan_draft ?? journeyDraft.pan ?? null) ?? record?.panMasked;
  const stepFormMeta = getKycStepFormMeta(activeStepId);
  const entryGateFormMeta = {
    ...getKycStepFormMeta(),
    title: copy.kyc.entryGate.title,
    description: copy.kyc.entryGate.description,
  };

  const renderJourneyFormHeader = () => {
    if (loadingBootstrap || bootstrapError) {
      return null;
    }

    if (activeStepId === "pan-card") {
      return (
        <KycFormHeader
          meta={stepFormMeta}
          badge={<KycPanReadinessBadge readiness={panReadiness} />}
        />
      );
    }

    return <KycFormHeader meta={stepFormMeta} />;
  };

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

    if (submitting && partnerEmbed?.kind === "esign") {
      return (
        <KycDialogProgressState
          variant="loading"
          message={copy.kyc.review.submitting}
        />
      );
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

    const mappedBank = mapBankDraft(bootstrap?.bank_draft);
    const manualRequired = bootstrap?.bank_verification_status === "manual_required";
    const bankInitialVerification =
      bootstrap?.bank_verification_status === "verified"
        ? {
            panVerified: true,
            bankVerified: true,
            readinessVerified: mappedBank?.readinessVerified ?? false,
            bankName: String(
              bootstrap?.bank_draft?.bankName ?? journeyDraft.bank?.accountDetails.bankName ?? "",
            ),
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
          : null;

    return (
      <>
        {journeyStepIds.has("pan-card") ? (
          <KycJourneyStepPanel stepId="pan-card" activeStepId={activeStepId}>
            <KycPanStep
              initialDraft={
                panReentryActive ? null : journeyDraft.pan ?? bootstrap?.pan_draft ?? null
              }
              initiallyVerified={panVerified && !panReentryActive}
              initialKycAlreadyRegistered={bootstrap?.kyc_already_registered ?? null}
              initialReadinessCode={panReadiness?.code ?? bootstrap?.readiness_code ?? null}
              onBlocked={handlePanBlocked}
              onPanVerified={({ kycAlreadyRegistered, readiness, panDraft }) => {
                updateDraft({ pan: panDraft });
                setBootstrap((current) =>
                  current
                    ? {
                        ...current,
                        pan_draft: panDraft,
                        pan_verification_status: "verified",
                        pan_verification_failure: null,
                        last_completed_step: "pan",
                        kyc_already_registered: kycAlreadyRegistered,
                        readiness_code: readiness?.code ?? current.readiness_code,
                        readiness_reason: readiness?.reason ?? current.readiness_reason,
                      }
                    : current,
                );
                setPanReadiness(readiness ?? null);
                syncKycRegistrationFromPan({
                  kycAlreadyRegistered,
                  readiness,
                  panVerified: true,
                });
                void fetchKycBootstrap()
                  .then((payload) => {
                    applyBootstrap(payload, { preserveActiveStep: true });
                  })
                  .catch(() => undefined);
                setPanReentryActive(false);
              }}
              onPanReset={() => {
                setPanReadiness(null);
                setPanReentryActive(true);
                updateDraft({ pan: undefined });
                setBootstrap((current) =>
                  current
                    ? {
                        ...current,
                        pan_draft: null,
                        pan_verification_status: null,
                        pan_verification_failure: null,
                      }
                    : current,
                );
              }}
              panResetRequiresConfirm={panResetRequiresConfirm}
              onRequestPanResetConfirm={handleRequestPanResetConfirm}
              onSubmit={handlePanSubmit}
              disabled={saving}
            />
          </KycJourneyStepPanel>
        ) : null}

        {journeyStepIds.has("address") ? (
          <KycJourneyStepPanel stepId="address" activeStepId={activeStepId}>
            <KycAddressStep
              initialValue={
                journeyDraft.address ?? mapContactDraft(bootstrap?.contact_draft) ?? createEmptyAddressForm()
              }
              stateOptions={stateOptions}
              prefilledFromDigilocker={prefilledFromDigilocker}
              digilockerFieldsLocked={prefilledFromDigilocker}
              digilockerPrefillIncomplete={
                Boolean(bootstrap?.requires_address_step_proof_digilocker) ? false : digilockerPrefillIncomplete
              }
              digilockerBlocked={digilockerBlocked}
              proofAddressOnly={Boolean(bootstrap?.requires_address_step_proof_digilocker)}
              digilockerFailureReason={digilockerAlertVisible ? digilockerAlertDescription : null}
              onRetryDigilocker={() => {
                void handleDigilockerRetry();
              }}
              retryingDigilocker={digilockerRetrying}
              saving={saving}
              onSubmit={handleAddressSubmit}
            />
          </KycJourneyStepPanel>
        ) : null}

        {journeyStepIds.has("personal-info") ? (
          <KycJourneyStepPanel stepId="personal-info" activeStepId={activeStepId}>
            <KycPersonalInfoStep
              initialValue={journeyDraft.personalInfo ?? mapPersonalDraft(bootstrap?.personal_draft)}
              enumOptions={enumOptions}
              nationalityOptions={nationalityOptions}
              fathersNameFromDigilocker={fathersNameFromDigilocker}
              saving={saving}
              onSubmit={handlePersonalSubmit}
            />
          </KycJourneyStepPanel>
        ) : null}

        {journeyStepIds.has("nominee") ? (
          <KycJourneyStepPanel stepId="nominee" activeStepId={activeStepId}>
            <KycNomineeStep
              key={nomineeStepMountKey}
              initialNominees={journeyDraft.nominees ?? mapNomineeDraft(bootstrap?.nominee_draft)}
              relationshipOptions={nomineeEnums?.relationships}
              sourceOfWealthOptions={nomineeEnums?.source_of_wealth}
              documentTypeOptions={nomineeEnums?.document_types}
              saving={saving}
              nominationOptedOut={Boolean(
                journeyDraft.nominationOptedOut ?? bootstrap?.nomination_opted_out,
              )}
              onRequestOptOut={() => {
                setNomineeOptOutDialogKey((current) => current + 1);
                setNomineeOptOutOpen(true);
              }}
              onSubmit={handleNomineeSubmit}
            />
          </KycJourneyStepPanel>
        ) : null}

        {journeyStepIds.has("bank") ? (
          <KycJourneyStepPanel stepId="bank" activeStepId={activeStepId}>
            <KycBankStep
              initialValue={journeyDraft.bank ?? mappedBank?.form ?? createEmptyBankForm()}
              initialAccountDetails={journeyDraft.bank?.accountDetails ?? mappedBank?.accountDetails ?? null}
              initialProofUploaded={Boolean(bootstrap?.poa_bank_proof_file_id)}
              initialVerification={bankInitialVerification}
              saving={saving}
              onSubmit={handleBankSubmit}
            />
          </KycJourneyStepPanel>
        ) : null}

        {journeyStepIds.has("signature") ? (
          <KycJourneyStepPanel stepId="signature" activeStepId={activeStepId}>
            <KycSignatureStep
              initialValue={
                journeyDraft.signature ??
                (bootstrap?.signature_draft as KycSignatureDraft | null | undefined)
              }
              onSubmit={handleSignatureSubmit}
            />
          </KycJourneyStepPanel>
        ) : null}

        {journeyStepIds.has("review") ? (
          <KycJourneyStepPanel stepId="review" activeStepId={activeStepId}>
            <div className="flex min-h-0 flex-1 flex-col">
              {submitError ? (
                <FieldMessage message={submitError} className="mb-3 mt-0 shrink-0" />
              ) : null}
              <KycReviewStep
                draft={journeyDraft}
                requiresFullKyc={requiresFullKyc}
                isSubmitting={submitting}
                onSubmit={() => void handleReviewSubmit()}
                nominationOptedOut={Boolean(journeyDraft.nominationOptedOut)}
                onAddNominee={() => {
                  setNomineeStepMountKey((current) => current + 1);
                  updateDraft({ nominationOptedOut: false });
                  void saveKycJourneyState({ revoke_nomination_opt_out: true }).catch(() => {
                    // Non-blocking — nominee step still allows add / re opt-out.
                  });
                  setActiveStepIndex(journeySteps.findIndex((step) => step.id === "nominee"));
                }}
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
            </div>
          </KycJourneyStepPanel>
        ) : null}
      </>
    );
  };

  const outcomeDialogClassName = cn(
    "kyc-dialog-root kyc-dialog-root--outcome kyc-dialog-surface kyc-subdialog-surface flex w-full max-w-sm flex-col items-center overflow-hidden rounded-3xl p-0 shadow-zynd-high ring-1 ring-border transition-none sm:max-w-sm",
  );

  const journeyDialogClassName = cn(
    "kyc-dialog-root kyc-dialog-surface kyc-dialog-surface--journey kyc-subdialog-surface flex w-full max-w-[1024px] flex-col overflow-hidden rounded-3xl p-0 shadow-zynd-high ring-0 transition-none sm:max-w-[1024px]",
  );

  const renderOutcomeContent = () => (
    <>
      <DialogTitle className="sr-only">{copy.kyc.pageTitle}</DialogTitle>
      <KycDialogBody
        variant="default"
        className="flex flex-col items-center justify-center px-5 py-6 text-center sm:px-6 sm:py-7"
      >
        {showVerifiedOutcome ? (
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
            actionLoading={checkingKraStatus}
          />
        )}
      </KycDialogBody>
    </>
  );

  const renderJourneyContent = () => (
    <>
      <DialogTitle className="sr-only">{copy.kyc.pageTitle}</DialogTitle>
      {!kycAllowed ? (
        <KycDialogLayout onClose={() => handleOpenChange(false)} activeStepId={activeStepId}>
          <KycDialogChrome
            title={copy.kyc.pageTitle}
            onClose={() => handleOpenChange(false)}
            showStepBadge={false}
            showClose={false}
            hideTitle
            hideBottomBorder
          />
          <KycDialogBody variant="default" showSecurityFooter>
            <KycFormHeader meta={entryGateFormMeta} />
            <KycEntryGate reasons={kycBlockReasons} onReady={() => openDialog()} />
          </KycDialogBody>
        </KycDialogLayout>
      ) : (
        <KycDialogLayout onClose={() => handleOpenChange(false)} activeStepId={activeStepId}>
          <KycDialogChrome
            activeStepIndex={activeStepIndex}
            maxReachableStepIndex={maxReachableStepIndex}
            steps={journeySteps}
            title={journeySteps[activeStepIndex]?.label ?? copy.kyc.pageTitle}
            onClose={() => handleOpenChange(false)}
            onStepSelect={handleStepSelect}
            showCircleSteps
            showStepBadge={false}
            showClose={false}
            hideTitle
          />
          <KycDialogBody
            variant={activeStepId === "review" ? "review" : "default"}
            showSecurityFooter
          >
            {renderJourneyFormHeader()}
            {journeySaveError ? (
              <FieldMessage message={journeySaveError} className="mb-3 mt-0 shrink-0" />
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col">{renderJourneyStep()}</div>
          </KycDialogBody>
        </KycDialogLayout>
      )}
    </>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          key="kyc-dialog"
          centeredLayout
          motion="fade"
          showCloseButton={shellOutcomeView}
          overlayClassName="kyc-dialog-overlay duration-200 data-closed:duration-150"
          className={shellOutcomeView ? outcomeDialogClassName : journeyDialogClassName}
        >
          {shellOutcomeView ? renderOutcomeContent() : renderJourneyContent()}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={exitConfirmOpen}
        onOpenChange={setExitConfirmOpen}
        variant="warning"
        title={copy.kyc.exitConfirm.title}
        description={copy.kyc.exitConfirm.description}
        confirmLabel={copy.kyc.exitConfirm.confirm}
        contentClassName="kyc-subdialog-surface rounded-3xl"
        showCloseButton
        hideCancelButton
        onConfirm={() => {
          setExitConfirmOpen(false);
          onOpenChange(false);
        }}
      />

      <ConfirmDialog
        open={panResetConfirmOpen}
        onOpenChange={(next) => {
          if (panResetConfirmLoading) return;
          if (!next) {
            panResetProceedRef.current = null;
          }
          setPanResetConfirmOpen(next);
        }}
        variant="warning"
        title={copy.kyc.panResetConfirm.title}
        description={copy.kyc.panResetConfirm.description}
        confirmLabel={copy.kyc.panResetConfirm.confirm}
        showCloseButton
        hideCancelButton
        contentClassName="kyc-subdialog-surface z-[80] max-w-sm rounded-3xl"
        overlayClassName="z-[80]"
        loading={panResetConfirmLoading}
        onConfirm={() => {
          void handleConfirmPanReset();
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

      <KycPartnerEmbedDialog
        open={Boolean(partnerEmbed?.url)}
        kind={partnerEmbed?.kind ?? "digilocker"}
        popupBlocked={partnerPopupBlocked}
        submittingApplication={submitting && partnerEmbed?.kind === "esign"}
        onClose={handlePartnerEmbedClose}
        onReopenPopup={reopenKycPartnerPopup}
        onOpenFullWindow={openPartnerEmbedFullWindow}
      />

      <KycDigilockerDialog
        open={digilockerRedirectOpen}
        variant={digilockerRedirectVariant}
        onOpenChange={(next) => {
          setDigilockerRedirectOpen(next);
          if (!next) {
            pendingDigilockerUrlRef.current = null;
          }
        }}
        onComplete={completeDigilockerRedirect}
      />

      <KycEsignDialog
        open={esignRedirectOpen}
        onOpenChange={(next) => {
          setEsignRedirectOpen(next);
          if (!next) {
            pendingEsignUrlRef.current = null;
          }
        }}
        onComplete={completeEsignRedirect}
      />

      <KycEsignIncompleteDialog
        open={esignIncompleteOpen}
        onOpenChange={setEsignIncompleteOpen}
        onRetry={() => void retryEsignFromIncomplete()}
        retrying={esignRetrying}
      />

      <KycDigilockerFailureDialog
        open={digilockerFailureDialogOpen}
        onOpenChange={setDigilockerFailureDialogOpen}
        description={digilockerAlertDescription}
        onRetry={() => void handleDigilockerRetry()}
        retrying={digilockerRetrying}
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

      <KycNomineeOptOutDialog
        key={nomineeOptOutDialogKey}
        open={nomineeOptOutOpen}
        confirming={saving}
        onOpenChange={setNomineeOptOutOpen}
        onConfirmed={() => {
          setNomineeOptOutOpen(false);
          void handleNomineeSubmit([], { recordNominationOptOut: true });
        }}
      />
    </>
  );
}
