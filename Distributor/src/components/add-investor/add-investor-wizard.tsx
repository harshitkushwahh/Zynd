"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  FileClock,
  Home,
  Landmark,
  Loader2,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import {
  AddInvestorAddressPanel,
  formatAddInvestorAddressReviewItems,
} from "@/components/add-investor/add-investor-address-panel";
import {
  AddInvestorBankPanel,
  formatAddInvestorBankReviewItems,
} from "@/components/add-investor/add-investor-bank-panel";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { AddInvestorCompliancePanelShell } from "@/components/add-investor/add-investor-compliance-panel-shell";
import { AddInvestorOnboardingPanel } from "@/components/add-investor/add-investor-onboarding-panel";
import { AddInvestorPanPanel } from "@/components/add-investor/add-investor-pan-panel";
import {
  AddInvestorPersonalInfoPanel,
  formatAddInvestorPersonalReviewItems,
} from "@/components/add-investor/add-investor-personal-info-panel";
import { AddInvestorEsignPanel } from "@/components/add-investor/add-investor-esign-panel";
import { AddInvestorDigilockerPanel } from "@/components/add-investor/add-investor-digilocker-panel";
import { AddInvestorNomineePanel } from "@/components/add-investor/add-investor-nominee-panel";
import {
  AddInvestorReviewPanel,
  type AddInvestorReviewSection,
} from "@/components/add-investor/add-investor-review-panel";
import { AddInvestorSignaturePanel } from "@/components/add-investor/add-investor-signature-panel";
import { AddInvestorSuccessDialog } from "@/components/add-investor/add-investor-success-dialog";
import { AddInvestorInProgressDialog } from "@/components/add-investor/add-investor-in-progress-dialog";
import { AddInvestorWizardSkeleton } from "@/components/add-investor/add-investor-wizard-skeleton";
import { useAddInvestorKycMasterData } from "@/components/add-investor/use-add-investor-kyc-master-data";
import { useAddInvestorPageReveal } from "@/components/add-investor/use-add-investor-page-reveal";
import { useAddInvestorStepSwitch } from "@/components/add-investor/use-add-investor-step-switch";
import { DistributorManagerBranchRequired } from "@/components/dashboard/distributor-manager-branch-required";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import {
  isValidSixDigitOtp,
  ADD_INVESTOR_JOURNEY_PHASE_LABEL,
  addInvestorStepIndex,
  buildAddInvestorJourneySteps,
  emptyAddressDraft,
  emptyBankDraft,
  emptyPersonalDraft,
  isAddInvestorAddressFieldsValid,
  isAddInvestorBankDraftValid,
  isAddInvestorPersonalDraftValid,
  isAddInvestorComplianceComplete,
  isAddInvestorPanNameValid,
  normalizeAddInvestorPersonalDraft,
  type AddInvestorAddressDraft,
  type AddInvestorBankDraft,
  type AddInvestorPanName,
  type AddInvestorPersonalDraft,
  type AddInvestorReadiness,
  type AddInvestorStepId,
} from "@/lib/add-investor/add-investor-journey";
import {
  areAddInvestorNomineesValid,
  formatAddInvestorNomineeSummary,
  type AddInvestorNomineeRecord,
} from "@/lib/add-investor/add-investor-nominee";
import {
  delay,
  DIGILOCKER_PREFILL_ADDRESS,
  normalizeMobileInput,
} from "@/lib/add-investor/add-investor-demo";
import { mapPanVerifyToInvestorReadiness } from "@/lib/add-investor/add-investor-pan-readiness";
import {
  clearStoredAddInvestorComplianceDraft,
  readStoredAddInvestorComplianceDraft,
  writeStoredAddInvestorComplianceDraft,
  type AddInvestorComplianceDraft,
} from "@/lib/add-investor/add-investor-compliance-storage";
import { resolveInvestorClientCodeDisplay } from "@/lib/add-investor/add-investor-client-code";
import { persistAddInvestorKycBeforeSubmit } from "@/lib/add-investor/add-investor-kyc-persist";
import {
  AddInvestorKycGeolocationError,
  requestAddInvestorKycGeolocation,
} from "@/lib/add-investor/add-investor-kyc-geolocation";
import {
  emptyComplianceSnapshot,
  hydrationFromClientKycBootstrap,
  hydrationFromComplianceSnapshot,
  mergeComplianceHydration,
  resolveResumeStepId,
  type AddInvestorComplianceHydration,
} from "@/lib/add-investor/add-investor-kyc-bootstrap";
import { buildAddInvestorInProgressItems } from "@/lib/add-investor/add-investor-in-progress-items";
import type { AddInvestorInProgressItem } from "@/lib/add-investor/add-investor-in-progress-items";
import { clearStoredClientOnboardingToken } from "@/lib/add-investor/add-investor-onboarding-storage";
import {
  type AddInvestorSuccessState,
} from "@/lib/add-investor/add-investor-success";
import { ApiError } from "@/lib/api-client";
import { fetchDistributorClients } from "@/lib/distributor-clients-api";
import type { DistributorInvestor } from "@/lib/distributor-types";
import {
  confirmClientKycPanNames,
  fetchClientKycBootstrap,
  submitClientKyc,
  verifyClientKycPan,
} from "@/lib/distributor-client-onboarding-api";
import type { AddInvestorSignatureTab } from "@/lib/add-investor/add-investor-signature";
import { YOUR_CLIENTS_LIST_HREF } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const ADD_INVESTOR_STEP_LABELS: Record<AddInvestorStepId, string> = {
  onboarding: "Contact verification",
  pan: "PAN verification",
  digilocker: "DigiLocker",
  "signature-upload": "Signature",
  address: "Address",
  "personal-info": "Personal info",
  nominee: "Nominee",
  bank: "Bank account",
  esign: "E-sign",
  review: "Review",
};

export function AddInvestorWizard() {
  const router = useRouter();
  const { showSkeleton: showPageSkeleton } = useAddInvestorPageReveal();
  const { masterData: kycMasterData } = useAddInvestorKycMasterData();
  const { stepId, displayStepId, goToStep: switchToStep, isSwitching, showPanelSkeleton } =
    useAddInvestorStepSwitch();
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [pan, setPan] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [panVerified, setPanVerified] = useState(false);
  const [panName, setPanName] = useState<AddInvestorPanName | null>(null);
  const [readiness, setReadiness] = useState<AddInvestorReadiness | null>(null);
  const [requiresDigilocker, setRequiresDigilocker] = useState<boolean | null>(null);
  const [panError, setPanError] = useState("");
  const [panLoading, setPanLoading] = useState(false);
  const [digilockerLoading, setDigilockerLoading] = useState(false);
  const [digilockerDone, setDigilockerDone] = useState(false);
  const [address, setAddress] = useState<AddInvestorAddressDraft>(emptyAddressDraft());
  const [addressFromDigilocker, setAddressFromDigilocker] = useState(false);
  const [personal, setPersonal] = useState<AddInvestorPersonalDraft>(emptyPersonalDraft());
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signatureMode, setSignatureMode] = useState<AddInvestorSignatureTab | null>(null);
  const signatureUploaded = signatureDataUrl.trim().length > 0;
  const [nominees, setNominees] = useState<AddInvestorNomineeRecord[]>([]);
  const [nomineeSubWizardActive, setNomineeSubWizardActive] = useState(false);
  const [bank, setBank] = useState<AddInvestorBankDraft>(emptyBankDraft());
  const [esignDone, setEsignDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successState, setSuccessState] = useState<AddInvestorSuccessState | null>(null);
  const [pendingInvestors, setPendingInvestors] = useState<DistributorInvestor[]>([]);
  const [localComplianceDraft, setLocalComplianceDraft] = useState<AddInvestorComplianceDraft | null>(null);
  const [inProgressDialogOpen, setInProgressDialogOpen] = useState(false);
  const skipCompliancePersistRef = useRef(false);
  const [maxReachedStepIndex, setMaxReachedStepIndex] = useState(0);

  const isNewToKyc = requiresDigilocker !== false;

  const complianceComplete = useMemo(
    () =>
      isAddInvestorComplianceComplete({
        requiresDigilocker: isNewToKyc,
        panVerified,
        panName,
        digilockerDone,
        signatureUploaded,
        address,
        personal,
        nominees,
        nomineeSubWizardActive,
        bank,
        esignDone,
      }),
    [
      address,
      bank,
      digilockerDone,
      esignDone,
      isNewToKyc,
      nomineeSubWizardActive,
      nominees,
      panName,
      panVerified,
      personal,
      signatureUploaded,
    ],
  );

  const accountHolderName = useMemo(() => {
    if (!panName) {
      return "";
    }
    return [panName.firstName, middleName, panName.lastName].filter(Boolean).join(" ");
  }, [middleName, panName]);

  const displayClientId = useMemo(
    () => resolveInvestorClientCodeDisplay(clientId, email, mobile),
    [clientId, email, mobile],
  );

  const reviewHero = useMemo(
    () => ({
      name: accountHolderName || "Investor",
      pan,
      kycPathLabel: isNewToKyc ? "New to KYC" : "KRA registered",
    }),
    [accountHolderName, isNewToKyc, pan],
  );

  const reviewSections = useMemo(() => {
    const sections: AddInvestorReviewSection[] = [
      {
        id: "contact",
        title: "Contact & access",
        icon: ShieldCheck,
        items: [
          ...(displayClientId !== "—"
            ? [{ label: "Investor code", value: displayClientId }]
            : []),
          { label: "Email", value: email },
          { label: "Mobile", value: `+91 ${mobile}` },
          {
            label: "MFA",
            value: "Set up on first Zynd sign-in",
            tone: "muted" as const,
          },
        ],
      },
      {
        id: "address",
        title: "Address",
        icon: Home,
        items: formatAddInvestorAddressReviewItems(address),
      },
      {
        id: "personal",
        title: "Personal details",
        icon: UserRound,
        items: formatAddInvestorPersonalReviewItems(personal, kycMasterData?.personal),
      },
      {
        id: "nominee",
        title: "Nominee",
        icon: Users,
        items: [
          nominees.length === 0
            ? { label: "Nomination", value: "None added", tone: "muted" }
            : {
                label: "Nomination",
                value: formatAddInvestorNomineeSummary(nominees),
              },
        ],
      },
      {
        id: "bank",
        title: "Bank account",
        icon: Landmark,
        wide: true,
        items: formatAddInvestorBankReviewItems(bank),
      },
    ];

    if (isNewToKyc) {
      sections.splice(1, 0, {
        id: "kyc-verification",
        title: "KYC verification",
        icon: BadgeCheck,
        items: [
          {
            label: "DigiLocker",
            value: digilockerDone ? "Aadhaar fetched" : "Pending",
            tone: digilockerDone ? "success" : "warning",
          },
          {
            label: "Signature",
            value: signatureUploaded
              ? signatureMode === "draw"
                ? "Drawn"
                : "Uploaded"
              : "Pending",
            tone: signatureUploaded ? "success" : "warning",
          },
          {
            label: "E-sign",
            value: esignDone ? "Completed" : "Pending",
            tone: esignDone ? "success" : "warning",
          },
        ],
      });
    }

    return sections;
  }, [
    address,
    bank,
    displayClientId,
    digilockerDone,
    email,
    esignDone,
    isNewToKyc,
    mobile,
    nominees,
    personal,
    signatureMode,
    signatureUploaded,
  ]);

  const journeySteps = useMemo(
    () => buildAddInvestorJourneySteps(requiresDigilocker ?? true),
    [requiresDigilocker],
  );

  const refreshPendingInvestors = useCallback(async () => {
    const items = await fetchDistributorClients({ limit: 100 });
    setPendingInvestors(items.filter((item) => item.onboardingStatus === "Pending"));
  }, []);

  useEffect(() => {
    setLocalComplianceDraft(readStoredAddInvestorComplianceDraft());
    void refreshPendingInvestors();
  }, [refreshPendingInvestors]);

  useEffect(() => {
    if (skipCompliancePersistRef.current || !onboardingComplete || !clientUserId) {
      return;
    }
    const draft: AddInvestorComplianceDraft = {
      clientUserId,
      clientId: displayClientId !== "—" ? displayClientId : clientId,
      email,
      mobile,
      investorName: accountHolderName || email,
      stepId,
      pan,
      updatedAt: new Date().toISOString(),
      snapshot: {
        panVerified,
        middleName,
        panName,
        readiness,
        requiresDigilocker,
        digilockerDone,
        address,
        addressFromDigilocker,
        personal,
        signatureDataUrl,
        signatureMode,
        nominees,
        bank,
        esignDone,
        maxReachedStepIndex,
      },
    };
    writeStoredAddInvestorComplianceDraft(draft);
    setLocalComplianceDraft(draft);
  }, [
    accountHolderName,
    address,
    addressFromDigilocker,
    bank,
    clientId,
    clientUserId,
    displayClientId,
    digilockerDone,
    email,
    esignDone,
    maxReachedStepIndex,
    middleName,
    mobile,
    nominees,
    onboardingComplete,
    pan,
    panName,
    panVerified,
    personal,
    readiness,
    requiresDigilocker,
    signatureDataUrl,
    signatureMode,
    stepId,
  ]);

  const inProgressItems = useMemo(
    () => buildAddInvestorInProgressItems(localComplianceDraft, pendingInvestors, ADD_INVESTOR_STEP_LABELS),
    [localComplianceDraft, pendingInvestors],
  );

  const resetCompliancePath = useCallback(() => {
    setDigilockerDone(false);
    setSignatureDataUrl("");
    setSignatureMode(null);
    setAddress(emptyAddressDraft());
    setAddressFromDigilocker(false);
    setPersonal(emptyPersonalDraft());
    setNominees([]);
    setBank(emptyBankDraft());
    setEsignDone(false);
  }, []);

  const applyComplianceHydration = useCallback((hydration: AddInvestorComplianceHydration) => {
    if (hydration.pan) {
      setPan(hydration.pan);
    }
    if (hydration.panVerified != null) {
      setPanVerified(hydration.panVerified);
    }
    if (hydration.panName !== undefined) {
      setPanName(hydration.panName);
    }
    if (hydration.middleName !== undefined) {
      setMiddleName(hydration.middleName);
    }
    if (hydration.readiness !== undefined) {
      setReadiness(hydration.readiness);
    }
    if (hydration.requiresDigilocker !== undefined && hydration.requiresDigilocker !== null) {
      setRequiresDigilocker(hydration.requiresDigilocker);
    }
    if (hydration.digilockerDone != null) {
      setDigilockerDone(hydration.digilockerDone);
    }
    if (hydration.address) {
      setAddress(hydration.address);
    }
    if (hydration.addressFromDigilocker != null) {
      setAddressFromDigilocker(hydration.addressFromDigilocker);
    }
    if (hydration.personal) {
      setPersonal(hydration.personal);
    }
    if (hydration.signatureDataUrl !== undefined) {
      setSignatureDataUrl(hydration.signatureDataUrl);
    }
    if (hydration.signatureMode !== undefined) {
      setSignatureMode(hydration.signatureMode);
    }
    if (hydration.nominees) {
      setNominees(hydration.nominees);
    }
    if (hydration.bank) {
      setBank(hydration.bank);
    }
    if (hydration.esignDone != null) {
      setEsignDone(hydration.esignDone);
    }
    if (hydration.maxReachedStepIndex != null) {
      setMaxReachedStepIndex((prev) => Math.max(prev, hydration.maxReachedStepIndex ?? 0));
    }
  }, []);

  const hydrateClientCompliance = useCallback(
    async (
      userId: string,
      draft: AddInvestorComplianceDraft | null | undefined,
      targetStepId?: AddInvestorStepId,
    ) => {
      skipCompliancePersistRef.current = true;

      let hydration: AddInvestorComplianceHydration = {};
      if (draft?.snapshot) {
        hydration = mergeComplianceHydration(
          hydration,
          hydrationFromComplianceSnapshot(draft.snapshot),
        );
      }

      try {
        const bootstrap = await fetchClientKycBootstrap(userId);
        hydration = mergeComplianceHydration(hydration, hydrationFromClientKycBootstrap(bootstrap));
        if (bootstrap.client_id) {
          setClientId(
            resolveInvestorClientCodeDisplay(
              bootstrap.client_id,
              draft?.email,
              draft?.mobile,
            ),
          );
        }
      } catch {
        // Keep local snapshot when server bootstrap is unavailable.
      }

      applyComplianceHydration(hydration);

      const resolvedRequiresDigilocker = hydration.requiresDigilocker ?? true;
      const steps = buildAddInvestorJourneySteps(resolvedRequiresDigilocker);
      const preferredStep = targetStepId ?? draft?.stepId ?? "pan";
      const stepToOpen = resolveResumeStepId(steps, preferredStep, hydration);
      switchToStep(stepToOpen);
      const idx = addInvestorStepIndex(steps, stepToOpen);
      if (idx >= 0) {
        setMaxReachedStepIndex((prev) =>
          Math.max(prev, hydration.maxReachedStepIndex ?? idx, idx),
        );
      }

      window.requestAnimationFrame(() => {
        skipCompliancePersistRef.current = false;
      });
    },
    [applyComplianceHydration, switchToStep],
  );

  const resetWizardSession = useCallback(() => {
    skipCompliancePersistRef.current = true;
    clearStoredAddInvestorComplianceDraft();
    clearStoredClientOnboardingToken();
    setLocalComplianceDraft(null);
    setOnboardingComplete(false);
    setClientUserId(null);
    setClientId("");
    setEmail("");
    setEmailOtp("");
    setMobile("");
    setMobileOtp("");
    setPan("");
    setMiddleName("");
    setPanVerified(false);
    setPanName(null);
    setReadiness(null);
    setRequiresDigilocker(null);
    setPanError("");
    setPanLoading(false);
    resetCompliancePath();
    setMaxReachedStepIndex(0);
    switchToStep("onboarding");
    setInProgressDialogOpen(false);
    window.requestAnimationFrame(() => {
      skipCompliancePersistRef.current = false;
    });
  }, [resetCompliancePath, switchToStep]);

  const resumeInProgress = async (item: AddInvestorInProgressItem) => {
    if (item.draft) {
      setClientUserId(item.draft.clientUserId);
      setClientId(
        resolveInvestorClientCodeDisplay(
          item.draft.clientId,
          item.draft.email,
          item.draft.mobile,
        ),
      );
      setEmail(item.draft.email);
      setMobile(item.draft.mobile);
      setOnboardingComplete(true);
      await hydrateClientCompliance(item.draft.clientUserId, item.draft, item.draft.stepId);
      return;
    }

    if (item.investor) {
      setClientUserId(item.investor.id);
      setClientId(item.investor.clientCode);
      setOnboardingComplete(true);
      await hydrateClientCompliance(item.investor.id, null, "pan");
    }
  };

  const discardActiveSession = () => {
    resetWizardSession();
  };

  const hasActiveSession = Boolean(localComplianceDraft || (onboardingComplete && clientUserId));

  const currentIndex = addInvestorStepIndex(journeySteps, stepId);
  const safeCurrentIndex = Math.max(currentIndex, 0);
  const journeyProgressPct =
    journeySteps.length > 0
      ? Math.round(((safeCurrentIndex + 1) / journeySteps.length) * 100)
      : 0;

  useEffect(() => {
    if (currentIndex < 0 && journeySteps.length > 0) {
      const fallbackIndex = Math.min(maxReachedStepIndex, journeySteps.length - 1);
      switchToStep(journeySteps[fallbackIndex].id);
    }
  }, [currentIndex, journeySteps, maxReachedStepIndex, switchToStep]);

  const markStepReached = (index: number) => {
    setMaxReachedStepIndex((prev) => Math.max(prev, index));
  };

  const goToStep = (id: AddInvestorStepId) => {
    const idx = addInvestorStepIndex(journeySteps, id);
    if (idx >= 0 && idx <= maxReachedStepIndex) {
      switchToStep(id);
    }
  };

  const goNext = () => {
    if (!canContinue) return;
    const idx = addInvestorStepIndex(journeySteps, stepId);
    if (idx >= 0 && idx < journeySteps.length - 1) {
      const nextIdx = idx + 1;
      markStepReached(nextIdx);
      switchToStep(journeySteps[nextIdx].id);
    }
  };

  const goBack = () => {
    const idx = addInvestorStepIndex(journeySteps, stepId);
    if (idx > 0) {
      switchToStep(journeySteps[idx - 1].id);
    }
  };

  const canContinue = (() => {
    switch (stepId) {
      case "onboarding":
        return onboardingComplete;
      case "pan":
        return panVerified && isAddInvestorPanNameValid(panName);
      case "digilocker":
        return digilockerDone;
      case "signature-upload":
        return signatureUploaded;
      case "address":
        return (
          isAddInvestorAddressFieldsValid(address.permanent) &&
          (address.correspondenceSame || isAddInvestorAddressFieldsValid(address.correspondence))
        );
      case "personal-info":
        return isAddInvestorPersonalDraftValid(personal);
      case "nominee":
        return areAddInvestorNomineesValid(nominees) && !nomineeSubWizardActive;
      case "bank":
        return isAddInvestorBankDraftValid(bank);
      case "esign":
        return esignDone;
      case "review":
        return complianceComplete && Boolean(clientUserId);
      default:
        return false;
    }
  })();

  const handlePanChange = (value: string) => {
    setPan(value);
    setPanVerified(false);
    setPanName(null);
    setMiddleName("");
    setReadiness(null);
    setRequiresDigilocker(null);
    resetCompliancePath();
    const panIdx = addInvestorStepIndex(journeySteps, "pan");
    if (panIdx >= 0) {
      setMaxReachedStepIndex(panIdx);
    }
  };

  const updatePanName = (patch: Partial<AddInvestorPanName>) => {
    setPanName((current) => (current ? { ...current, ...patch } : null));
  };

  const handleVerifyPan = async () => {
    if (!clientUserId) {
      setPanError("Complete investor onboarding before verifying PAN.");
      return;
    }
    setPanError("");
    setPanLoading(true);
    try {
      const result = await verifyClientKycPan(clientUserId, pan);
      if (result.blocked) {
        setPanError(result.message || "This PAN cannot be used for KYC.");
        setPanVerified(false);
        setPanName(null);
        setReadiness(null);
        return;
      }
      if (!result.success || !result.pan_draft) {
        setPanError(result.failure?.reason || "Could not verify PAN. Check the number and try again.");
        setPanVerified(false);
        setPanName(null);
        setReadiness(null);
        return;
      }
      const draft = result.pan_draft;
      const fullName = String(draft.fullName ?? "").trim();
      const firstName = String(draft.firstName ?? "").trim();
      let lastName = String(draft.lastName ?? "").trim();
      const singleNameOnly = Boolean(
        (draft as { singleNameOnly?: boolean }).singleNameOnly
        ?? (fullName.split(/\s+/).filter(Boolean).length === 1
          || (firstName && lastName && firstName.toUpperCase() === lastName.toUpperCase())),
      );
      if (singleNameOnly) {
        lastName = "";
      }
      setPanName({
        firstName,
        lastName,
        dateOfBirth: draft.dateOfBirth ?? "",
        panCategory: draft.panCategory ?? "",
        singleNameOnly,
      });
      setMiddleName(draft.middleName ?? "");
      setReadiness(
        mapPanVerifyToInvestorReadiness({
          kycAlreadyRegistered: result.kyc_already_registered,
          readiness: result.readiness,
        }),
      );
      setRequiresDigilocker(
        result.requires_digilocker ?? !Boolean(result.kyc_already_registered),
      );
      setPanVerified(true);
      markStepReached(addInvestorStepIndex(journeySteps, "pan"));
    } catch (error) {
      setPanError(
        error instanceof ApiError
          ? error.message || "Could not verify PAN."
          : "Could not verify PAN.",
      );
      setPanVerified(false);
      setPanName(null);
      setReadiness(null);
    } finally {
      setPanLoading(false);
    }
  };

  const handlePanContinue = async () => {
    if (!panVerified || !panName || !clientUserId || panLoading) return;
    if (!isAddInvestorPanNameValid(panName)) {
      setPanError(
        panName.singleNameOnly
          ? "Enter a valid first name from the PAN registry."
          : "Enter valid first and last names from the PAN registry.",
      );
      return;
    }
    setPanError("");
    setPanLoading(true);
    try {
      const confirmResult = await confirmClientKycPanNames(clientUserId, {
        first_name: panName.firstName.trim(),
        middle_name: middleName.trim(),
        last_name: panName.lastName.trim(),
      });
      if (confirmResult.blocked) {
        setPanError(confirmResult.failure?.reason || "Could not confirm PAN name details.");
        return;
      }
      if (!confirmResult.success) {
        setPanError("Could not confirm PAN name details.");
        return;
      }
      if (confirmResult.requires_digilocker != null) {
        setRequiresDigilocker(confirmResult.requires_digilocker);
      }
      if (!isNewToKyc) {
        setAddress(emptyAddressDraft());
        setAddressFromDigilocker(false);
      }
      goNext();
    } catch (error) {
      setPanError(
        error instanceof ApiError
          ? error.message || "Could not confirm PAN name details."
          : "Could not confirm PAN name details.",
      );
    } finally {
      setPanLoading(false);
    }
  };

  const handleDigilockerConnect = async () => {
    setDigilockerLoading(true);
    await delay(1200);
    setAddress({
      permanent: { ...DIGILOCKER_PREFILL_ADDRESS },
      correspondence: { ...DIGILOCKER_PREFILL_ADDRESS },
      correspondenceSame: true,
    });
    setAddressFromDigilocker(true);
    setDigilockerDone(true);
    setDigilockerLoading(false);
  };

  const handleSubmit = async () => {
    if (!complianceComplete || !clientUserId) {
      setSubmitError("Complete every compliance step before submitting.");
      return;
    }
    if (!clientId && displayClientId === "—") {
      setSubmitError("Investor account details are missing. Restart from onboarding.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      await persistAddInvestorKycBeforeSubmit({
        clientUserId,
        address,
        personal,
        nominees,
        bank,
        signatureDataUrl,
        signatureMode,
        requiresDigilocker: requiresDigilocker ?? true,
      });

      let submitBody: { latitude?: number; longitude?: number; accuracy_meters?: number } | undefined;
      if (requiresDigilocker ?? true) {
        const coords = await requestAddInvestorKycGeolocation();
        submitBody = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy_meters: coords.accuracy,
        };
      }

      await submitClientKyc(clientUserId, submitBody);

      setSuccessState({
        clientCode: displayClientId,
        investorName: accountHolderName || email,
        email,
        mobile,
        pan,
        kycPath: isNewToKyc ? "New to KYC" : "KRA registered",
      });
      clearStoredAddInvestorComplianceDraft();
      setLocalComplianceDraft(null);
      await refreshPendingInvestors();
    } catch (error) {
      if (error instanceof AddInvestorKycGeolocationError) {
        setSubmitError(error.message);
        return;
      }
      setSubmitError(
        error instanceof ApiError
          ? error.message || "Could not submit KYC. Try again."
          : "Could not submit KYC. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessDone = () => {
    setSuccessState(null);
    clearStoredAddInvestorComplianceDraft();
    setLocalComplianceDraft(null);
    router.push(YOUR_CLIENTS_LIST_HREF);
  };

  const updatePersonal = (patch: Partial<AddInvestorPersonalDraft>) => {
    setPersonal((current) => normalizeAddInvestorPersonalDraft({ ...current, ...patch }));
  };

  const updateBank = (patch: Partial<AddInvestorBankDraft>) => {
    setBank((current) => ({ ...current, ...patch }));
  };

  const handleKeyboardContinue = () => {
    if (stepId === "review") {
      if (complianceComplete && !submitting && !successState) {
        void handleSubmit();
      }
      return;
    }
    if (stepId === "pan") {
      if (panVerified) {
        void handlePanContinue();
      } else if (pan.length === 10 && !panLoading) {
        void handleVerifyPan();
      }
      return;
    }
    if (!canContinue) return;
    goNext();
  };

  useWizardKeyboardNavigation({
    enabled: stepId !== "onboarding",
    onContinue: handleKeyboardContinue,
    onBack: goBack,
    canContinue: (() => {
      if (isSwitching) return false;
      if (stepId === "review") return complianceComplete && !submitting && !successState;
      if (stepId === "pan") {
        return panVerified ? !panLoading : pan.length === 10 && !panLoading;
      }
      return canContinue;
    })(),
    canBack: safeCurrentIndex > 0 && !isSwitching,
  });

  const complianceFooter = (() => {
    if (stepId === "pan") {
      if (panVerified) {
        return (
          <AddInvestorWizardStepFooter
            onBack={goBack}
            onContinue={() => void handlePanContinue()}
            canBack={safeCurrentIndex > 0}
            continueDisabled={panLoading}
          />
        );
      }

      return (
        <>
          <DistributorActionButton
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={safeCurrentIndex <= 0}
          >
            Back
          </DistributorActionButton>
          <DistributorActionButton
            type="button"
            onClick={() => void handleVerifyPan()}
            disabled={pan.length !== 10 || panLoading}
          >
            {panLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Fetching name…
              </>
            ) : (
              "Verify PAN & fetch name"
            )}
          </DistributorActionButton>
        </>
      );
    }

    if (stepId === "review") {
      return (
        <AddInvestorWizardStepFooter
          onBack={goBack}
          onContinue={() => void handleSubmit()}
          canBack={currentIndex > 0}
          continueDisabled={!complianceComplete || submitting || Boolean(successState)}
          continueLabel={submitting ? "Submitting…" : "Complete profile"}
        />
      );
    }

    return (
      <AddInvestorWizardStepFooter
        onBack={goBack}
        onContinue={goNext}
        canBack={currentIndex > 0}
        continueDisabled={!canContinue}
      />
    );
  })();

  if (showPageSkeleton) {
    return (
      <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
        <DistributorPageHeader title="Add investor" description="" />
        <DistributorManagerBranchRequired>
          <AddInvestorWizardSkeleton panelStep={displayStepId} />
        </DistributorManagerBranchRequired>
      </div>
    );
  }

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Add investor" description="">
        <DistributorActionButton
          type="button"
          variant="outline"
          onClick={() => setInProgressDialogOpen(true)}
        >
          <FileClock className="size-4" aria-hidden />
          In progress
          {inProgressItems.length > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {inProgressItems.length}
            </span>
          ) : null}
        </DistributorActionButton>
      </DistributorPageHeader>

      <AddInvestorInProgressDialog
        open={inProgressDialogOpen}
        onOpenChange={setInProgressDialogOpen}
        items={inProgressItems}
        activeClientUserId={clientUserId}
        onResume={(item) => {
          void resumeInProgress(item).finally(() => setInProgressDialogOpen(false));
        }}
        onDiscardActiveSession={discardActiveSession}
        hasActiveSession={hasActiveSession}
      />

      <DistributorManagerBranchRequired>
      <div
        className={cn(
          "quick-txn-wizard add-investor-wizard distributor-wizard-page--enter",
          isSwitching && "quick-txn-wizard--switching",
        )}
      >
        <nav className="quick-txn-wizard__journey" aria-label="Add investor journey" aria-busy={isSwitching}>
          <div className="quick-txn-journey-header">
            <div>
              <p className="quick-txn-journey-header__title">Investor journey</p>
              <p className="quick-txn-journey-header__meta">
                Step {safeCurrentIndex + 1} of {journeySteps.length}
              </p>
            </div>
            <span className="quick-txn-journey-header__pct">{journeyProgressPct}%</span>
          </div>
          <div
            className="quick-txn-journey-progress"
            role="progressbar"
            aria-valuenow={journeyProgressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="quick-txn-journey-progress__bar" style={{ width: `${journeyProgressPct}%` }} />
          </div>
          <ol className="quick-txn-journey-steps">
            {journeySteps.map((item, index) => {
              const active = item.id === displayStepId;
              const done = index <= maxReachedStepIndex && !active;
              const upcoming = index > maxReachedStepIndex;
              const StepIcon = item.icon;
              const navigable = index <= maxReachedStepIndex;
              const showPhaseLabel =
                index === 0 || journeySteps[index - 1]?.phase !== item.phase;

              return (
                <li key={item.id} className="quick-txn-journey-step-group">
                  {showPhaseLabel ? (
                    <p className="quick-txn-journey-phase-label">
                      {ADD_INVESTOR_JOURNEY_PHASE_LABEL[item.phase]}
                    </p>
                  ) : null}
                  <div
                    className={cn(
                      "quick-txn-journey-step",
                      active && "quick-txn-journey-step--active",
                      done && "quick-txn-journey-step--done",
                      upcoming && "quick-txn-journey-step--upcoming",
                    )}
                  >
                    <div className="quick-txn-journey-step__rail" aria-hidden>
                      <span className="quick-txn-journey-step__marker">
                        {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                      </span>
                      {index < journeySteps.length - 1 ? (
                        <span
                          className={cn(
                            "quick-txn-journey-step__line",
                            done && "quick-txn-journey-step__line--done",
                          )}
                        />
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="quick-txn-journey-step__body"
                      disabled={!navigable}
                      aria-current={active ? "step" : undefined}
                      onClick={() => {
                        if (navigable) goToStep(item.id);
                      }}
                    >
                      <span className="quick-txn-journey-step__icon" aria-hidden>
                        <StepIcon className="size-4" strokeWidth={active ? 2.25 : 2} />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="quick-txn-journey-step__label">{item.label}</span>
                        <span className="quick-txn-journey-step__desc">{item.description}</span>
                      </span>
                      {active ? (
                        <span className="quick-txn-journey-step__pill">Current</span>
                      ) : done ? (
                        <CheckCircle2 className="quick-txn-journey-step__done-icon size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                      ) : null}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="quick-txn-wizard__panel">
          {showPanelSkeleton ? (
            <AddInvestorWizardSkeleton panelStep={displayStepId} panelOnly />
          ) : (
            <>
          <div
            className={cn(
              "add-investor-wizard__step-panel",
              stepId !== "onboarding" && "add-investor-wizard__step-panel--hidden",
            )}
            aria-hidden={stepId !== "onboarding"}
          >
            <AddInvestorOnboardingPanel
              email={email}
              onEmailChange={setEmail}
              emailOtp={emailOtp}
              onEmailOtpChange={setEmailOtp}
              emailValid={isValidEmail(email)}
              mobile={mobile}
              onMobileChange={(value) => setMobile(normalizeMobileInput(value))}
              mobileOtp={mobileOtp}
              onMobileOtpChange={setMobileOtp}
              mobileValid={mobile.length === 10}
              onboardingComplete={onboardingComplete}
              createdClientId={clientId}
              onAccountCreated={(result) => {
                setClientUserId(result.client_user_id);
                setClientId(
                  resolveInvestorClientCodeDisplay(
                    result.client_id,
                    result.email,
                    result.mobile,
                  ),
                );
                setEmail(result.email);
                if (result.mobile) {
                  setMobile(result.mobile.replace(/\D/g, "").slice(-10));
                }
                setOnboardingComplete(true);
              }}
              onFinished={goNext}
            />
          </div>

          <div
            className={cn(
              "add-investor-wizard__step-panel",
              stepId === "onboarding" && "add-investor-wizard__step-panel--hidden",
            )}
            aria-hidden={stepId === "onboarding"}
          >
            <AddInvestorCompliancePanelShell
              journeySteps={journeySteps}
              stepId={stepId}
              footer={complianceFooter}
            >
              <div
                className={cn(
                  "add-investor-wizard__step-panel",
                  stepId !== "pan" && "add-investor-wizard__step-panel--hidden",
                )}
                aria-hidden={stepId !== "pan"}
              >
                <AddInvestorPanPanel
                  pan={pan}
                  onPanChange={handlePanChange}
                  middleName={middleName}
                  onMiddleNameChange={setMiddleName}
                  onFirstNameChange={(value) => updatePanName({ firstName: value })}
                  onLastNameChange={(value) => updatePanName({ lastName: value })}
                  panVerified={panVerified}
                  panLoading={panLoading}
                  panError={panError}
                  panName={panName}
                  readiness={readiness}
                />
              </div>

              <div
                className={cn(
                  "add-investor-wizard__step-panel",
                  stepId !== "digilocker" && "add-investor-wizard__step-panel--hidden",
                )}
                aria-hidden={stepId !== "digilocker"}
              >
                <AddInvestorDigilockerPanel
                  loading={digilockerLoading}
                  done={digilockerDone}
                  onConnect={handleDigilockerConnect}
                />
              </div>

              <div
                className={cn(
                  "add-investor-wizard__step-panel",
                  stepId !== "signature-upload" && "add-investor-wizard__step-panel--hidden",
                )}
                aria-hidden={stepId !== "signature-upload"}
              >
                <AddInvestorSignaturePanel
                  signatureDataUrl={signatureDataUrl}
                  signatureMode={signatureMode}
                  onSignatureChange={(dataUrl, mode) => {
                    setSignatureDataUrl(dataUrl);
                    setSignatureMode(mode);
                  }}
                />
              </div>

              <div
                className={cn(
                  "add-investor-wizard__step-panel add-investor-compliance-wizard__step add-investor-compliance-wizard__step--address",
                  stepId !== "address" && "add-investor-wizard__step-panel--hidden",
                )}
                aria-hidden={stepId !== "address"}
              >
                <AddInvestorAddressPanel
                  address={address}
                  onAddressChange={setAddress}
                  permanentReadOnly={addressFromDigilocker}
                  prefilledFromDigilocker={addressFromDigilocker}
                  addressMasterData={kycMasterData}
                />
              </div>

              <div
                className={cn(
                  "add-investor-wizard__step-panel add-investor-compliance-wizard__step add-investor-compliance-wizard__step--personal",
                  stepId !== "personal-info" && "add-investor-wizard__step-panel--hidden",
                )}
                aria-hidden={stepId !== "personal-info"}
              >
                <AddInvestorPersonalInfoPanel
                  personal={normalizeAddInvestorPersonalDraft(personal)}
                  onPersonalChange={updatePersonal}
                  personalOptions={kycMasterData?.personal}
                />
              </div>

              <div
                className={cn(
                  "add-investor-wizard__step-panel add-investor-compliance-wizard__step add-investor-compliance-wizard__step--nominee",
                  stepId !== "nominee" && "add-investor-wizard__step-panel--hidden",
                )}
                aria-hidden={stepId !== "nominee"}
              >
                <AddInvestorNomineePanel
                  nominees={nominees}
                  onNomineesChange={setNominees}
                  onSubWizardActiveChange={setNomineeSubWizardActive}
                  nomineeOptions={kycMasterData?.nominee}
                />
              </div>

              <div
                className={cn(
                  "add-investor-wizard__step-panel",
                  stepId !== "bank" && "add-investor-wizard__step-panel--hidden",
                )}
                aria-hidden={stepId !== "bank"}
              >
                <AddInvestorBankPanel
                  bank={bank}
                  onBankChange={updateBank}
                  accountHolderName={accountHolderName}
                  clientUserId={clientUserId}
                  panVerified={panVerified}
                />
              </div>

              <div
                className={cn(
                  "add-investor-wizard__step-panel",
                  stepId !== "esign" && "add-investor-wizard__step-panel--hidden",
                )}
                aria-hidden={stepId !== "esign"}
              >
                <AddInvestorEsignPanel done={esignDone} onSign={() => setEsignDone(true)} />
              </div>

              <div
                className={cn(
                  "add-investor-wizard__step-panel add-investor-compliance-wizard__step add-investor-compliance-wizard__step--review",
                  stepId !== "review" && "add-investor-wizard__step-panel--hidden",
                )}
                aria-hidden={stepId !== "review"}
              >
                <AddInvestorReviewPanel hero={reviewHero} sections={reviewSections} />
                {!complianceComplete ? (
                  <DistributorFeedbackMessage variant="warning" className="add-distributor-wizard-feedback">
                    Complete every compliance step before submitting this profile.
                  </DistributorFeedbackMessage>
                ) : null}
                {submitError ? (
                  <DistributorFeedbackMessage
                    variant="error"
                    className="add-distributor-wizard-feedback"
                    onDismiss={() => setSubmitError("")}
                  >
                    {submitError}
                  </DistributorFeedbackMessage>
                ) : null}
              </div>
            </AddInvestorCompliancePanelShell>
          </div>
            </>
          )}
        </div>
      </div>

      <AddInvestorSuccessDialog
        open={Boolean(successState)}
        state={successState}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleSuccessDone();
          }
        }}
        onDone={handleSuccessDone}
      />
      </DistributorManagerBranchRequired>
    </div>
  );
}
