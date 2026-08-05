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
import { AddDistributorReviewPanel } from "@/components/add-distributor/add-distributor-review-panel";
import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import {
  ADD_DISTRIBUTOR_DEMO_OTP,
  ADD_DISTRIBUTOR_JOURNEY_STEPS,
  addDistributorStepIndex,
  emptyAddressDraft,
  emptyBankDraft,
  emptyDocumentDraft,
  emptyNameDraft,
  type AddDistributorAddressDraft,
  type AddDistributorBankDraft,
  type AddDistributorDocumentDraft,
  type AddDistributorNameDraft,
  type AddDistributorStepId,
} from "@/lib/add-distributor/add-distributor-journey";
import { ADD_INVESTOR_DEMO_OTP } from "@/lib/add-investor/add-investor-journey";
import { delay, normalizeMobileInput, verifyDemoPan } from "@/lib/add-investor/add-investor-demo";
import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.trim().toUpperCase());
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
  const [address, setAddress] = useState<AddDistributorAddressDraft>(emptyAddressDraft());
  const [documents, setDocuments] = useState<AddDistributorDocumentDraft>(emptyDocumentDraft());
  const [submitting, setSubmitting] = useState(false);
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

  const markStepReached = (index: number) => {
    setMaxReachedStepIndex((prev) => Math.max(prev, index));
  };

  const goToStep = (id: AddDistributorStepId) => {
    const idx = addDistributorStepIndex(id);
    if (idx >= 0 && idx <= maxReachedStepIndex) {
      setStepId(id);
    }
  };

  const goNext = () => {
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

  const goBack = () => {
    const idx = addDistributorStepIndex(stepId);
    if (idx > 0) {
      setStepId(journeySteps[idx - 1].id);
    }
  };

  const canContinue = (() => {
    switch (stepId) {
      case "email":
        return isValidEmail(email) && emailOtp === ADD_INVESTOR_DEMO_OTP;
      case "mobile":
        return mobile.length === 10 && mobileOtp === ADD_DISTRIBUTOR_DEMO_OTP;
      case "pan":
        return panVerified;
      case "name":
        return name.firstName.trim().length >= 2 && name.lastName.trim().length >= 2;
      case "bank": {
        const acct = bank.accountNumber.replace(/\D/g, "");
        const confirm = bank.confirmAccountNumber.replace(/\D/g, "");
        return (
          bank.accountHolderName.trim().length >= 3 &&
          acct.length >= 9 &&
          acct === confirm &&
          isValidIfsc(bank.ifsc) &&
          bank.bankName.trim().length >= 2
        );
      }
      case "address":
        return (
          address.line1.trim().length > 2 &&
          address.city.trim().length > 1 &&
          address.state.trim().length > 1 &&
          address.pincode.length === 6
        );
      case "documents":
        return Boolean(documents.panFileName && documents.aadharFileName);
      case "review":
        return true;
      default:
        return false;
    }
  })();

  const reviewEmail = useMemo(() => email.trim(), [email]);

  const updateName = (patch: Partial<AddDistributorNameDraft>) => {
    setName((current) => ({ ...current, ...patch }));
  };

  const updateBank = (patch: Partial<AddDistributorBankDraft>) => {
    setBank((current) => ({ ...current, ...patch }));
  };

  const updateAddress = (patch: Partial<AddDistributorAddressDraft>) => {
    setAddress((current) => ({ ...current, ...patch }));
  };

  const handleVerifyPan = async () => {
    setPanError("");
    setPanLoading(true);
    await delay(700);
    const result = verifyDemoPan(pan);
    setPanLoading(false);
    if (!result.ok) {
      setPanError(result.error);
      setPanVerified(false);
      setPanRegistryName(null);
      return;
    }
    const registryName = [result.panName.firstName, result.panName.lastName].filter(Boolean).join(" ");
    setPanRegistryName(registryName);
    setPanVerified(true);
    setName((current) =>
      current.firstName.trim()
        ? current
        : {
            firstName: result.panName.firstName,
            middleName: "",
            lastName: result.panName.lastName,
          },
    );
  };

  const handlePanContinue = () => {
    if (panVerified) {
      goNext();
      return;
    }
    if (pan.length === 10 && !panLoading) {
      void handleVerifyPan();
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    await delay(800);
    setSubmitting(false);
    router.push("/dashboard/dist-management/distributors");
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
    goNext();
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
          : canContinue,
    canBack: safeCurrentIndex > 0,
  });

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title={ZYND_MITRA_COPY.add} />

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
              value={email}
              onValueChange={setEmail}
              otp={emailOtp}
              onOtpChange={setEmailOtp}
              inputValid={isValidEmail(email)}
              onBack={goBack}
              onContinue={goNext}
              canBack={safeCurrentIndex > 0}
            />
          ) : null}

          {stepId === "mobile" ? (
            <AddDistributorContactVerifyPanel
              channel="mobile"
              value={mobile}
              onValueChange={(value) => setMobile(normalizeMobileInput(value))}
              otp={mobileOtp}
              onOtpChange={setMobileOtp}
              inputValid={mobile.length === 10}
              onBack={goBack}
              onContinue={goNext}
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
              onContinue={goNext}
              canBack={safeCurrentIndex > 0}
              continueDisabled={!canContinue}
            />
          ) : null}

          {stepId === "bank" ? (
            <AddDistributorBankPanel
              bank={bank}
              onBankChange={updateBank}
              onBack={goBack}
              onContinue={goNext}
              canBack={safeCurrentIndex > 0}
              continueDisabled={!canContinue}
            />
          ) : null}

          {stepId === "address" ? (
            <AddDistributorAddressPanel
              address={address}
              onAddressChange={updateAddress}
              onBack={goBack}
              onContinue={goNext}
              canBack={safeCurrentIndex > 0}
              continueDisabled={!canContinue}
            />
          ) : null}

          {stepId === "documents" ? (
            <AddDistributorDocumentsPanel
              documents={documents}
              onDocumentsChange={(patch) => setDocuments((current) => ({ ...current, ...patch }))}
              onBack={goBack}
              onContinue={goNext}
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
                  Branch manager submits the pack for HO compliance and ARN provisioning (demo).
                </p>

                <AddDistributorReviewPanel
                  branchLabel={branchLabel}
                  email={reviewEmail}
                  mobile={mobile}
                  pan={pan}
                  name={name}
                  bank={bank}
                  address={address}
                  documents={documents}
                />
              </div>
            </AddDistributorWizardPanelShell>
          ) : null}
        </div>
      </div>
    </div>
  );
}
