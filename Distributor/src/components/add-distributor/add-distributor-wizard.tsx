"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";

import { AddDistributorAddressPanel } from "@/components/add-distributor/add-distributor-address-panel";
import { AddDistributorBankPanel } from "@/components/add-distributor/add-distributor-bank-panel";
import { AddDistributorContactVerifyPanel } from "@/components/add-distributor/add-distributor-contact-verify-panel";
import { AddDistributorDocumentsPanel } from "@/components/add-distributor/add-distributor-documents-panel";
import { AddDistributorNamePanel } from "@/components/add-distributor/add-distributor-name-panel";
import { AddDistributorPanPanel } from "@/components/add-distributor/add-distributor-pan-panel";
import { AddDistributorProfilePhotoPanel } from "@/components/add-distributor/add-distributor-profile-photo-panel";
import { AddDistributorReviewPanel } from "@/components/add-distributor/add-distributor-review-panel";
import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { DistributorManagerBranchRequired } from "@/components/dashboard/distributor-manager-branch-required";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { isValidSixDigitOtp } from "@/lib/add-investor/add-investor-journey";
import {
  ADD_DISTRIBUTOR_JOURNEY_STEPS,
  addDistributorStepIndex,
  emptyAddressDraft,
  emptyBankDraft,
  emptyDocumentDraft,
  emptyNameDraft,
  isAddDistributorBankDraftReady,
  isAddDistributorBankManualDraftReady,
  type AddDistributorAddressDraft,
  type AddDistributorBankDraft,
  type AddDistributorDocumentDraft,
  type AddDistributorNameDraft,
  type AddDistributorStepId,
} from "@/lib/add-distributor/add-distributor-journey";
import {
  partnerOnboardingResumeStepIndex,
  resolvePartnerOnboardingResumeStep,
} from "@/lib/add-distributor/add-distributor-hydrate";
import {
  clearStoredPartnerOnboardingToken,
  readStoredPartnerOnboardingToken,
  writeStoredPartnerOnboardingToken,
} from "@/lib/add-distributor/add-distributor-onboarding-storage";
import {
  fetchPartnerOnboardingDocumentPreviewUrl,
  fetchPartnerOnboardingDraft,
  fetchPartnerOnboardingProfilePhotoPreviewUrl,
  submitPartnerOnboarding,
  updatePartnerOnboardingDraft,
  verifyPartnerOnboardingBank,
  verifyPartnerOnboardingBankManual,
  verifyPartnerOnboardingPan,
  type PartnerOnboardingDraftSnapshot,
} from "@/lib/distributor-partners-api";
import { ApiError } from "@/lib/api-client";
import { normalizeMobileInput } from "@/lib/add-investor/add-investor-demo";
import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatFullName(name: AddDistributorNameDraft): string {
  return [name.firstName, name.middleName, name.lastName].filter(Boolean).join(" ").trim();
}

export function AddDistributorWizard() {
  const router = useRouter();
  const { branchLabel } = useDistributorAuth();

  const [stepId, setStepId] = useState<AddDistributorStepId>("email");
  const [maxReachedStepIndex, setMaxReachedStepIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [name, setName] = useState<AddDistributorNameDraft>(emptyNameDraft());
  const [mobile, setMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [pan, setPan] = useState("");
  const [panVerified, setPanVerified] = useState(false);
  const [panLoading, setPanLoading] = useState(false);
  const [panError, setPanError] = useState("");
  const [panRegistryName, setPanRegistryName] = useState<string | null>(null);
  const [bank, setBank] = useState<AddDistributorBankDraft>(emptyBankDraft());
  const [bankVerified, setBankVerified] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState("");
  const [bankAutoVerifyFailed, setBankAutoVerifyFailed] = useState(false);
  const [address, setAddress] = useState<AddDistributorAddressDraft>(emptyAddressDraft());
  const [documents, setDocuments] = useState<AddDistributorDocumentDraft>(emptyDocumentDraft());
  const [profilePhotoFileName, setProfilePhotoFileName] = useState<string | null>(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null);
  const [profilePhotoUploaded, setProfilePhotoUploaded] = useState(false);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [draftSyncing, setDraftSyncing] = useState(false);
  const activeJourneyStepRef = useRef<HTMLLIElement>(null);

  const journeySteps = ADD_DISTRIBUTOR_JOURNEY_STEPS;
  const currentIndex = addDistributorStepIndex(stepId);
  const safeCurrentIndex = Math.max(currentIndex, 0);
  const journeyProgressPct =
    journeySteps.length > 0
      ? Math.round(((safeCurrentIndex + 1) / journeySteps.length) * 100)
      : 0;

  useEffect(() => {
    if (currentIndex >= 0) {
      setMaxReachedStepIndex((prev) => Math.max(prev, currentIndex));
    }
  }, [currentIndex]);

  useEffect(() => {
    activeJourneyStepRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [stepId]);

  const previewUrlsRef = useRef({
    profilePhoto: null as string | null,
    pan: null as string | null,
    aadhaar: null as string | null,
  });

  useEffect(() => {
    previewUrlsRef.current = {
      profilePhoto: profilePhotoPreviewUrl,
      pan: documents.panPreviewUrl,
      aadhaar: documents.aadhaarPreviewUrl,
    };
  }, [documents.aadhaarPreviewUrl, documents.panPreviewUrl, profilePhotoPreviewUrl]);

  useEffect(() => {
    return () => {
      const urls = previewUrlsRef.current;
      for (const url of [urls.profilePhoto, urls.pan, urls.aadhaar]) {
        if (url?.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, []);

  const handleOnboardingTokenChange = (token: string | null) => {
    setOnboardingToken(token);
    writeStoredPartnerOnboardingToken(token);
  };

  const applyDraftSnapshot = async (token: string, draft: PartnerOnboardingDraftSnapshot) => {
    setOnboardingToken(token);
    writeStoredPartnerOnboardingToken(token);

    if (draft.email) setEmail(draft.email);
    if (draft.mobile) setMobile(draft.mobile);
    if (draft.pan) setPan(draft.pan);
    setPanVerified(Boolean(draft.pan_verified));
    setPanRegistryName(draft.pan_verified_name);

    setName({
      firstName: draft.first_name?.trim() ?? "",
      middleName: draft.middle_name?.trim() ?? "",
      lastName: draft.last_name?.trim() ?? "",
    });

    const bankDraft = draft.bank;
    if (bankDraft) {
      setBank({
        accountNumber: bankDraft.account_number ?? "",
        confirmAccountNumber: bankDraft.confirm_account_number ?? "",
        accountType: bankDraft.account_type ?? "",
        ifsc: bankDraft.ifsc ?? "",
        accountVerified: Boolean(draft.bank_verified),
        verificationMode:
          bankDraft.verification_mode === "manual" || bankDraft.verification_mode === "auto"
            ? bankDraft.verification_mode
            : "",
        manualMode: bankDraft.verification_mode === "manual",
        accountHolderName: bankDraft.account_holder_name ?? "",
        bankName: bankDraft.bank_name ?? "",
        branchName: bankDraft.branch_name ?? "",
      });
    }
    setBankVerified(Boolean(draft.bank_verified));

    const addressDraft = draft.address;
    if (addressDraft) {
      setAddress({
        line1: addressDraft.line1 ?? "",
        line2: addressDraft.line2 ?? "",
        city: addressDraft.city ?? "",
        state: addressDraft.state ?? "",
        pincode: String(addressDraft.pincode ?? ""),
        country: addressDraft.country ?? "India",
      });
    }

    const nextDocuments: AddDistributorDocumentDraft = {
      panFileName: draft.documents.pan_file_name,
      aadharFileName: draft.documents.aadhaar_file_name,
      panPreviewUrl: null,
      aadhaarPreviewUrl: null,
    };
    setDocuments(nextDocuments);
    setProfilePhotoFileName(draft.profile_photo.file_name);
    setProfilePhotoUploaded(Boolean(draft.profile_photo.uploaded));
    setProfilePhotoPreviewUrl(null);

    const previewTasks: Promise<void>[] = [];
    if (draft.documents.pan_uploaded) {
      previewTasks.push(
        fetchPartnerOnboardingDocumentPreviewUrl(token, "pan").then((url) => {
          setDocuments((current) => ({ ...current, panPreviewUrl: url }));
        }),
      );
    }
    if (draft.documents.aadhaar_uploaded) {
      previewTasks.push(
        fetchPartnerOnboardingDocumentPreviewUrl(token, "aadhaar").then((url) => {
          setDocuments((current) => ({ ...current, aadhaarPreviewUrl: url }));
        }),
      );
    }
    if (draft.profile_photo.uploaded) {
      previewTasks.push(
        fetchPartnerOnboardingProfilePhotoPreviewUrl(token).then((url) => {
          setProfilePhotoPreviewUrl(url);
        }),
      );
    }
    if (previewTasks.length > 0) {
      await Promise.allSettled(previewTasks);
    }

    const resumeStep = resolvePartnerOnboardingResumeStep(draft);
    const resumeIndex = partnerOnboardingResumeStepIndex(draft);
    setStepId(resumeStep);
    setMaxReachedStepIndex(resumeIndex);
  };

  useEffect(() => {
    let cancelled = false;
    const storedToken = readStoredPartnerOnboardingToken();
    if (!storedToken) {
      setHydrating(false);
      return;
    }

    void (async () => {
      try {
        const draft = await fetchPartnerOnboardingDraft(storedToken);
        if (cancelled) return;
        await applyDraftSnapshot(storedToken, draft);
      } catch {
        if (!cancelled) {
          clearStoredPartnerOnboardingToken();
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const markStepReached = (index: number) => {
    setMaxReachedStepIndex((prev) => Math.max(prev, index));
  };

  const goToStep = (id: AddDistributorStepId) => {
    const idx = addDistributorStepIndex(id);
    if (idx >= 0 && idx <= maxReachedStepIndex) {
      setStepId(id);
    }
  };

  const advanceToNextStep = () => {
    const idx = addDistributorStepIndex(stepId);
    if (idx >= 0 && idx < journeySteps.length - 1) {
      const nextIdx = idx + 1;
      const nextId = journeySteps[nextIdx].id;
      if (nextId === "bank" && !bank.accountHolderName.trim()) {
        setBank((current) => ({
          ...current,
          accountHolderName: formatFullName(name),
        }));
      }
      markStepReached(nextIdx);
      setStepId(nextId);
    }
  };

  const syncDraftForStep = async (currentStep: AddDistributorStepId): Promise<boolean> => {
    if (!onboardingToken) {
      setSubmitError("Onboarding session expired. Start again from email verification.");
      return false;
    }
    setDraftSyncing(true);
    setSubmitError("");
    try {
      switch (currentStep) {
        case "pan":
          await updatePartnerOnboardingDraft(onboardingToken, {
            pan,
            pan_verified_name: panRegistryName,
          });
          break;
        case "name":
          await updatePartnerOnboardingDraft(onboardingToken, {
            first_name: name.firstName.trim(),
            middle_name: name.middleName.trim() || undefined,
            last_name: name.lastName.trim(),
          });
          break;
        case "bank":
          await updatePartnerOnboardingDraft(onboardingToken, {
            bank: {
              account_holder_name: bank.accountHolderName.trim(),
              account_number: bank.accountNumber.replace(/\D/g, ""),
              confirm_account_number: bank.confirmAccountNumber.replace(/\D/g, "") || undefined,
              account_type: bank.accountType,
              ifsc: bank.ifsc.trim().toUpperCase(),
              bank_name: bank.bankName.trim(),
              branch_name: bank.branchName.trim() || undefined,
              verification_mode: bank.verificationMode || undefined,
            },
          });
          break;
        case "address":
          await updatePartnerOnboardingDraft(onboardingToken, {
            address: {
              line1: address.line1.trim(),
              line2: address.line2.trim() || undefined,
              city: address.city.trim(),
              state: address.state.trim(),
              pincode: address.pincode,
              country: address.country.trim() || "India",
            },
          });
          break;
        default:
          break;
      }
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message || "Could not save progress." : "Could not save progress.";
      setSubmitError(message);
      return false;
    } finally {
      setDraftSyncing(false);
    }
  };

  const goNext = async () => {
    if (stepId === "pan" || stepId === "name" || stepId === "bank" || stepId === "address") {
      const saved = await syncDraftForStep(stepId);
      if (!saved) return;
    }
    advanceToNextStep();
  };

  const goBack = () => {
    const idx = addDistributorStepIndex(stepId);
    if (idx > 0) {
      setStepId(journeySteps[idx - 1].id);
    }
  };

  const canContinue = (() => {
    switch (stepId) {
      case "email":
        return isValidEmail(email) && isValidSixDigitOtp(emailOtp);
      case "mobile":
        return mobile.length === 10 && isValidSixDigitOtp(mobileOtp);
      case "pan":
        return panVerified;
      case "name":
        return name.firstName.trim().length >= 2 && name.lastName.trim().length >= 2;
      case "bank":
        return bankVerified;
      case "address":
        return (
          address.line1.trim().length > 2 &&
          address.city.trim().length > 1 &&
          address.state.trim().length > 1 &&
          address.pincode.length === 6
        );
      case "documents":
        return Boolean(documents.panFileName && documents.aadharFileName);
      case "photo":
        return profilePhotoUploaded;
      case "review":
        return true;
      default:
        return false;
    }
  })();

  const reviewEmail = useMemo(() => email.trim(), [email]);
  const reviewDisplayName = useMemo(() => formatFullName(name), [name]);

  const updateName = (patch: Partial<AddDistributorNameDraft>) => {
    setName((current) => ({ ...current, ...patch }));
  };

  const updateBank = (patch: Partial<AddDistributorBankDraft>) => {
    setBank((current) => ({ ...current, ...patch }));
    setBankVerified(false);
    setBankError("");
    setBankAutoVerifyFailed(false);
  };

  const handleEnterManualBankMode = () => {
    setBankError("");
    setBankAutoVerifyFailed(false);
    setBankVerified(false);
    setBank((current) => ({
      ...current,
      manualMode: true,
      accountVerified: false,
      verificationMode: "",
      accountHolderName: current.accountHolderName || panRegistryName || "",
    }));
  };

  const applyBankVerifyResult = (result: {
    verified_holder_name: string;
    bank_name: string;
    branch_name: string;
    account_type: string;
    verification_mode?: string;
  }) => {
    setBankAutoVerifyFailed(false);
    setBankVerified(true);
    setBank((current) => ({
      ...current,
      accountVerified: true,
      accountHolderName: result.verified_holder_name,
      bankName: result.bank_name || current.bankName,
      branchName: result.branch_name || current.branchName,
      accountType: result.account_type || current.accountType,
      verificationMode: (result.verification_mode as AddDistributorBankDraft["verificationMode"]) || "auto",
    }));
  };

  const updateAddress = (patch: Partial<AddDistributorAddressDraft>) => {
    setAddress((current) => ({ ...current, ...patch }));
  };

  const handleVerifyPan = async () => {
    if (!onboardingToken) {
      setPanError("Onboarding session expired. Start again from email verification.");
      return;
    }
    setPanError("");
    setPanLoading(true);
    try {
      const result = await verifyPartnerOnboardingPan(onboardingToken, pan);
      setPanRegistryName(result.verified_name);
      setPanVerified(true);
    } catch (error) {
      setPanError(error instanceof ApiError ? error.message : "Could not verify PAN.");
      setPanVerified(false);
      setPanRegistryName(null);
    } finally {
      setPanLoading(false);
    }
  };

  const handleVerifyBank = async () => {
    if (!onboardingToken) {
      setBankError("Onboarding session expired. Start again from email verification.");
      return;
    }
    if (bank.manualMode) {
      await handleVerifyBankManual();
      return;
    }
    if (!isAddDistributorBankDraftReady(bank)) {
      setBankError("Enter account number, account type, and IFSC before verifying.");
      return;
    }
    const acct = bank.accountNumber.replace(/\D/g, "");
    setBankError("");
    setBankAutoVerifyFailed(false);
    setBankLoading(true);
    try {
      const result = await verifyPartnerOnboardingBank(onboardingToken, {
        account_number: acct,
        account_type: bank.accountType,
        ifsc: bank.ifsc.trim().toUpperCase(),
      });
      applyBankVerifyResult({ ...result, verification_mode: "auto" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Could not verify bank account.";
      setBankError(message);
      setBankAutoVerifyFailed(true);
      setBankVerified(false);
    } finally {
      setBankLoading(false);
    }
  };

  const handleVerifyBankManual = async () => {
    if (!onboardingToken) {
      setBankError("Onboarding session expired. Start again from email verification.");
      return;
    }
    if (!isAddDistributorBankManualDraftReady(bank)) {
      setBankError("Enter complete bank details before saving.");
      return;
    }
    const acct = bank.accountNumber.replace(/\D/g, "");
    setBankError("");
    setBankLoading(true);
    try {
      const result = await verifyPartnerOnboardingBankManual(onboardingToken, {
        account_holder_name: bank.accountHolderName.trim(),
        account_number: acct,
        confirm_account_number: bank.confirmAccountNumber.replace(/\D/g, ""),
        account_type: bank.accountType,
        ifsc: bank.ifsc.trim().toUpperCase(),
        bank_name: bank.bankName.trim(),
        branch_name: bank.branchName.trim(),
      });
      applyBankVerifyResult(result);
    } catch (error) {
      setBankError(error instanceof ApiError ? error.message : "Could not save bank details.");
      setBankVerified(false);
    } finally {
      setBankLoading(false);
    }
  };

  const handleBankContinue = () => {
    if (bankVerified) {
      void goNext();
      return;
    }
    void handleVerifyBank();
  };

  const handlePanContinue = () => {
    if (panVerified) {
      void goNext();
      return;
    }
    if (pan.length === 10 && !panLoading) {
      void handleVerifyPan();
    }
  };

  const handleSubmit = async () => {
    if (submitting || !onboardingToken) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await submitPartnerOnboarding(onboardingToken);
      clearStoredPartnerOnboardingToken();
      router.push("/dashboard/dist-management/distributors");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message || "Could not submit onboarding." : "Could not submit onboarding.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyboardContinue = () => {
    if (stepId === "review") {
      void handleSubmit();
      return;
    }
    if (stepId === "pan") {
      handlePanContinue();
      return;
    }
    if (stepId === "bank") {
      handleBankContinue();
      return;
    }
    void goNext();
  };

  useWizardKeyboardNavigation({
    enabled: stepId !== "email" && stepId !== "mobile",
    onContinue: handleKeyboardContinue,
    onBack: goBack,
    canContinue:
      stepId === "review"
        ? !submitting
        : stepId === "pan"
          ? panVerified || (pan.length === 10 && !panLoading)
          : stepId === "bank"
            ? bankVerified ||
              ((bank.manualMode
                ? isAddDistributorBankManualDraftReady(bank)
                : isAddDistributorBankDraftReady(bank)) &&
                !bankLoading)
            : draftSyncing
              ? false
              : canContinue,
    canBack: safeCurrentIndex > 0,
  });

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title={ZYND_MITRA_COPY.add} />

      <DistributorManagerBranchRequired>
      {hydrating ? (
        <div className="add-distributor-wizard distributor-wizard-page--enter flex min-h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Restoring onboarding progress…
        </div>
      ) : (
      <div className="quick-txn-wizard add-investor-wizard add-distributor-wizard distributor-wizard-page--enter">
        <nav className="quick-txn-wizard__journey" aria-label={ZYND_MITRA_COPY.addJourney}>
          <div className="quick-txn-journey-header">
            <div>
              <p className="quick-txn-journey-header__title">{ZYND_MITRA_COPY.onboarding}</p>
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
              const active = item.id === stepId;
              const done = index <= maxReachedStepIndex && !active;
              const upcoming = index > maxReachedStepIndex;
              const StepIcon = item.icon;
              const navigable = index <= maxReachedStepIndex;

              return (
                <li
                  key={item.id}
                  ref={active ? activeJourneyStepRef : undefined}
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
                      <CheckCircle2
                        className="quick-txn-journey-step__done-icon size-4 shrink-0"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="quick-txn-wizard__panel">
          {stepId === "email" ? (
            <AddDistributorContactVerifyPanel
              channel="email"
              onboardingToken={onboardingToken}
              onOnboardingTokenChange={handleOnboardingTokenChange}
              value={email}
              onValueChange={setEmail}
              otp={emailOtp}
              onOtpChange={setEmailOtp}
              inputValid={isValidEmail(email)}
              onBack={goBack}
              onContinue={() => void goNext()}
              canBack={safeCurrentIndex > 0}
            />
          ) : null}

          {stepId === "mobile" ? (
            <AddDistributorContactVerifyPanel
              channel="mobile"
              onboardingToken={onboardingToken}
              onOnboardingTokenChange={handleOnboardingTokenChange}
              value={mobile}
              onValueChange={(value) => setMobile(normalizeMobileInput(value))}
              otp={mobileOtp}
              onOtpChange={setMobileOtp}
              inputValid={mobile.length === 10}
              onBack={goBack}
              onContinue={() => void goNext()}
              canBack={safeCurrentIndex > 0}
            />
          ) : null}

          {stepId === "pan" ? (
            <AddDistributorPanPanel
              pan={pan}
              onPanChange={(value) => {
                setPan(value);
                setPanVerified(false);
                setPanError("");
                setPanRegistryName(null);
              }}
              panVerified={panVerified}
              panLoading={panLoading}
              panError={panError}
              verifiedName={panRegistryName}
              onBack={goBack}
              onContinue={handlePanContinue}
              canBack={safeCurrentIndex > 0}
              continueDisabled={panLoading || (!panVerified && pan.length !== 10)}
            />
          ) : null}

          {stepId === "name" ? (
            <AddDistributorNamePanel
              name={name}
              onNameChange={updateName}
              onBack={goBack}
              onContinue={() => void goNext()}
              canBack={safeCurrentIndex > 0}
              continueDisabled={!canContinue || draftSyncing}
            />
          ) : null}

          {stepId === "bank" ? (
            <AddDistributorBankPanel
              bank={bank}
              onBankChange={updateBank}
              bankVerified={bankVerified}
              bankLoading={bankLoading}
              bankError={bankError}
              showManualFallback={bankAutoVerifyFailed}
              onEnterManualMode={handleEnterManualBankMode}
              onBack={goBack}
              onContinue={handleBankContinue}
              canBack={safeCurrentIndex > 0}
              continueDisabled={
                bankLoading ||
                (!bankVerified &&
                  !(bank.manualMode
                    ? isAddDistributorBankManualDraftReady(bank)
                    : isAddDistributorBankDraftReady(bank)))
              }
            />
          ) : null}

          {stepId === "address" ? (
            <AddDistributorAddressPanel
              address={address}
              onAddressChange={updateAddress}
              onBack={goBack}
              onContinue={() => void goNext()}
              canBack={safeCurrentIndex > 0}
              continueDisabled={!canContinue || draftSyncing}
            />
          ) : null}

          {stepId === "documents" ? (
            <AddDistributorDocumentsPanel
              onboardingToken={onboardingToken}
              documents={documents}
              onDocumentsChange={(patch) => setDocuments((current) => ({ ...current, ...patch }))}
              onBack={goBack}
              onContinue={() => void goNext()}
              canBack={safeCurrentIndex > 0}
              continueDisabled={!canContinue}
            />
          ) : null}

          {stepId === "photo" ? (
            <AddDistributorProfilePhotoPanel
              onboardingToken={onboardingToken}
              displayName={reviewDisplayName || ZYND_MITRA_COPY.singular}
              fileName={profilePhotoFileName}
              previewUrl={profilePhotoPreviewUrl}
              uploaded={profilePhotoUploaded}
              onUploaded={({ fileName, previewUrl }) => {
                setProfilePhotoFileName(fileName);
                setProfilePhotoPreviewUrl((current) => {
                  if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
                  return previewUrl;
                });
                setProfilePhotoUploaded(true);
              }}
              onClear={() => {
                setProfilePhotoFileName(null);
                setProfilePhotoPreviewUrl((current) => {
                  if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
                  return null;
                });
                setProfilePhotoUploaded(false);
              }}
              onBack={goBack}
              onContinue={() => void goNext()}
              canBack={safeCurrentIndex > 0}
              continueDisabled={!canContinue}
            />
          ) : null}

          {stepId === "review" ? (
            <AddDistributorWizardPanelShell
              stepId="review"
              title="Onboarding"
              className="add-investor-wizard-panel--onboarding"
              footer={
                <>
                  <DistributorActionButton type="button" variant="outline" onClick={goBack} disabled={safeCurrentIndex <= 0}>
                    Back
                  </DistributorActionButton>
                  <DistributorActionButton type="button" disabled={submitting} onClick={() => void handleSubmit()}>
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Submitting…
                      </>
                    ) : (
                      ZYND_MITRA_COPY.submit
                    )}
                  </DistributorActionButton>
                </>
              }
            >
              <div className="add-investor-onboarding-wizard__center add-distributor-review-panel">
                <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
                  <ClipboardCheck className="size-6" strokeWidth={2.25} />
                </span>
                <h3 className="add-investor-onboarding-wizard__title">Review & submit</h3>
                <p className="add-investor-onboarding-wizard__desc">
                  Submit for HO compliance review.
                </p>

                <div className="add-distributor-review-panel__content">
                  {submitError ? (
                    <DistributorFeedbackMessage
                      variant="error"
                      className="add-distributor-wizard-feedback"
                      onDismiss={() => setSubmitError("")}
                    >
                      {submitError}
                    </DistributorFeedbackMessage>
                  ) : null}

                  <AddDistributorReviewPanel
                    branchLabel={branchLabel}
                    email={reviewEmail}
                    mobile={mobile}
                    pan={pan}
                    name={name}
                    bank={bank}
                    address={address}
                    documents={documents}
                    profilePhotoPreviewUrl={profilePhotoPreviewUrl}
                    onboardingToken={onboardingToken}
                  />
                </div>
              </div>
            </AddDistributorWizardPanelShell>
          ) : null}
        </div>
      </div>
      )}
      </DistributorManagerBranchRequired>
    </div>
  );
}
