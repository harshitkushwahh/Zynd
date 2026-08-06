"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
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
import { AddInvestorWizardSkeleton } from "@/components/add-investor/add-investor-wizard-skeleton";
import { useAddInvestorPageReveal } from "@/components/add-investor/use-add-investor-page-reveal";
import { useAddInvestorStepSwitch } from "@/components/add-investor/use-add-investor-step-switch";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  verifyDemoPan,
} from "@/lib/add-investor/add-investor-demo";
import {
  createDemoInvestorClientCode,
  type AddInvestorSuccessState,
} from "@/lib/add-investor/add-investor-success";
import type { AddInvestorSignatureTab } from "@/lib/add-investor/add-investor-signature";
import { YOUR_CLIENTS_LIST_HREF } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AddInvestorWizard() {
  const router = useRouter();
  const { showSkeleton: showPageSkeleton } = useAddInvestorPageReveal();
  const { stepId, displayStepId, goToStep: switchToStep, isSwitching, showPanelSkeleton } =
    useAddInvestorStepSwitch();
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBound, setMfaBound] = useState(false);
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
  const [successState, setSuccessState] = useState<AddInvestorSuccessState | null>(null);
  const [maxReachedStepIndex, setMaxReachedStepIndex] = useState(0);

  const isNewToKyc = requiresDigilocker !== false;

  const accountHolderName = useMemo(() => {
    if (!panName) {
      return "";
    }
    return [panName.firstName, middleName, panName.lastName].filter(Boolean).join(" ");
  }, [middleName, panName]);

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
          { label: "Email", value: email },
          { label: "Mobile", value: `+91 ${mobile}` },
          { label: "MFA", value: "Authenticator enrolled", tone: "success" },
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
        items: formatAddInvestorPersonalReviewItems(personal),
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

  useEffect(() => {
    if (currentIndex >= 0) {
      setMaxReachedStepIndex((prev) => Math.max(prev, currentIndex));
    }
  }, [currentIndex]);

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
        return (
          isValidEmail(email) &&
          isValidSixDigitOtp(emailOtp) &&
          mobile.length === 10 &&
          isValidSixDigitOtp(mobileOtp) &&
          mfaBound &&
          mfaCode.length === 6
        );
      case "pan":
        return panVerified && Boolean(panName?.firstName.trim()) && Boolean(panName?.lastName.trim());
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
        return true;
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
    setPanError("");
    setPanLoading(true);
    await delay(700);
    const result = await verifyDemoPan(pan);
    setPanLoading(false);
    if (!result.ok) {
      setPanError(result.error);
      setPanVerified(false);
      setPanName(null);
      setReadiness(null);
      return;
    }
    const nameParts = result.displayName.trim().split(/\s+/);
    setPanName({
      firstName: nameParts[0] ?? "",
      lastName: nameParts.length > 1 ? (nameParts.at(-1) ?? "") : "",
      dateOfBirth: "",
      panCategory: "",
    });
    setMiddleName(nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "");
    setReadiness(
      result.kycAlreadyRegistered
        ? {
            code: "kra_registered",
            label: "KRA registered",
            hint: "Existing KYC on record.",
          }
        : {
            code: "new_to_kyc",
            label: "New to KYC",
            hint: "Complete DigiLocker and e-sign.",
          },
    );
    setRequiresDigilocker(!result.kycAlreadyRegistered);
    setPanVerified(true);
    markStepReached(addInvestorStepIndex(journeySteps, "pan"));
  };

  const handlePanContinue = () => {
    if (!panVerified) return;
    if (!isNewToKyc) {
      setAddress(emptyAddressDraft());
      setAddressFromDigilocker(false);
    }
    goNext();
  };

  const resetCompliancePath = () => {
    setDigilockerDone(false);
    setSignatureDataUrl("");
    setSignatureMode(null);
    setAddress(emptyAddressDraft());
    setAddressFromDigilocker(false);
    setPersonal(emptyPersonalDraft());
    setNominees([]);
    setBank(emptyBankDraft());
    setEsignDone(false);
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
    setSubmitting(true);
    await delay(600);
    setSuccessState({
      clientCode: createDemoInvestorClientCode(),
      investorName: accountHolderName || email,
      email,
      mobile,
      pan,
      kycPath: isNewToKyc ? "New to KYC" : "KRA registered",
    });
    setSubmitting(false);
  };

  const handleSuccessDone = () => {
    setSuccessState(null);
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
      void handleSubmit();
      return;
    }
    if (stepId === "pan") {
      if (panVerified) {
        handlePanContinue();
      } else if (pan.length === 10 && !panLoading) {
        void handleVerifyPan();
      }
      return;
    }
    goNext();
  };

  useWizardKeyboardNavigation({
    enabled: stepId !== "onboarding",
    onContinue: handleKeyboardContinue,
    onBack: goBack,
    canContinue: (() => {
      if (isSwitching) return false;
      if (stepId === "review") return !submitting && !successState;
      if (stepId === "pan") {
        return panVerified ? true : pan.length === 10 && !panLoading;
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
            onContinue={handlePanContinue}
            canBack={safeCurrentIndex > 0}
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
          continueDisabled={submitting || Boolean(successState)}
          continueLabel={submitting ? "Completing profile…" : "Complete Profile"}
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
        <AddInvestorWizardSkeleton panelStep={displayStepId} />
      </div>
    );
  }

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Add investor" description="" />

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
              mfaBound={mfaBound}
              onMfaBoundChange={setMfaBound}
              mfaCode={mfaCode}
              onMfaCodeChange={setMfaCode}
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
    </div>
  );
}
