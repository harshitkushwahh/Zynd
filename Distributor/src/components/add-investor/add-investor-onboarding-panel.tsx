"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, KeyRound, Loader2, Mail, Pencil, Phone } from "lucide-react";

import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";

import { AddInvestorOnboardingDraftDialog } from "@/components/add-investor/add-investor-onboarding-draft-dialog";
import { AddInvestorOtpField } from "@/components/add-investor/add-investor-otp-field";
import { AddInvestorWizardPanelShell } from "@/components/add-investor/add-investor-wizard-panel-shell";
import { AddInvestorWizardProgress } from "@/components/add-investor/add-investor-wizard-progress";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Button } from "@/components/ui/button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { Input } from "@/components/ui/input";
import { isValidSixDigitOtp } from "@/lib/add-investor/add-investor-journey";
import {
  getContactOnboardingProgressIndex,
  resolveClientOnboardingResume,
  type ClientOnboardingContactScreen,
  type ClientOnboardingResumePhase,
} from "@/lib/add-investor/add-investor-onboarding-hydrate";
import {
  clearStoredClientOnboardingToken,
  readStoredClientOnboardingToken,
  writeStoredClientOnboardingToken,
} from "@/lib/add-investor/add-investor-onboarding-storage";
import { resolveInvestorClientCodeDisplay } from "@/lib/add-investor/add-investor-client-code";
import { INVESTOR_ONBOARDING_PROGRESS_STEPS } from "@/lib/add-investor/add-investor-onboarding-progress";
import { ApiError } from "@/lib/api-client";
import {
  discardClientOnboardingDraft,
  fetchClientOnboardingDraft,
  resendClientOnboardingEmailOtp,
  resendClientOnboardingMobileOtp,
  startClientOnboarding,
  submitClientOnboarding,
  updateClientOnboardingContact,
  verifyClientOnboardingEmail,
  verifyClientOnboardingMobile,
  type ClientOnboardingDraftSnapshot,
  type ClientOnboardingSubmitResponse,
} from "@/lib/distributor-client-onboarding-api";

type AddInvestorOnboardingPanelProps = {
  email: string;
  onEmailChange: (value: string) => void;
  emailOtp: string;
  onEmailOtpChange: (value: string) => void;
  emailValid: boolean;
  mobile: string;
  onMobileChange: (value: string) => void;
  mobileOtp: string;
  onMobileOtpChange: (value: string) => void;
  mobileValid: boolean;
  onboardingComplete: boolean;
  createdClientId?: string;
  onAccountCreated: (result: ClientOnboardingSubmitResponse) => void;
  onFinished: () => void;
};

type DraftDialogMode = "resume" | "change-email" | "change-mobile";

const EMPTY_DRAFT: ClientOnboardingDraftSnapshot = {
  email: null,
  email_verified: false,
  mobile: null,
  mobile_verified: false,
  ready_to_create: false,
};

function readApiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  return fallback;
}

export function AddInvestorOnboardingPanel({
  email,
  onEmailChange,
  emailOtp,
  onEmailOtpChange,
  emailValid,
  mobile,
  onMobileChange,
  mobileOtp,
  onMobileOtpChange,
  mobileValid,
  onboardingComplete,
  createdClientId,
  onAccountCreated,
  onFinished,
}: AddInvestorOnboardingPanelProps) {
  const [phase, setPhase] = useState<ClientOnboardingResumePhase>("email");
  const [contactScreen, setContactScreen] = useState<ClientOnboardingContactScreen>("input");
  const [draft, setDraft] = useState<ClientOnboardingDraftSnapshot>(EMPTY_DRAFT);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<ClientOnboardingSubmitResponse | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftDialogMode, setDraftDialogMode] = useState<DraftDialogMode>("resume");
  const [pendingDraft, setPendingDraft] = useState<ClientOnboardingDraftSnapshot | null>(null);

  const persistToken = useCallback((token: string | null) => {
    setOnboardingToken(token);
    writeStoredClientOnboardingToken(token);
  }, []);

  const applyDraftSnapshot = useCallback(
    (snapshot: ClientOnboardingDraftSnapshot, token: string) => {
      setDraft(snapshot);
      persistToken(token);
      if (snapshot.email) onEmailChange(snapshot.email);
      if (snapshot.mobile) onMobileChange(snapshot.mobile);
      onEmailOtpChange("");
      onMobileOtpChange("");

      const resume = resolveClientOnboardingResume(snapshot, onboardingComplete);
      setPhase(resume.phase);
      if (resume.phase === "email" && snapshot.email_verified) {
        setContactScreen("verified");
      } else if (resume.phase === "mobile" && snapshot.mobile_verified) {
        setContactScreen("verified");
      } else {
        setContactScreen(resume.contactScreen);
      }
    },
    [onEmailChange, onEmailOtpChange, onMobileChange, onMobileOtpChange, onboardingComplete, persistToken],
  );

  useEffect(() => {
    if (onboardingComplete) {
      setPhase("account");
      setHydrating(false);
      return;
    }

    let cancelled = false;
    const storedToken = readStoredClientOnboardingToken();
    if (!storedToken) {
      setHydrating(false);
      return;
    }

    void (async () => {
      try {
        const snapshot = await fetchClientOnboardingDraft(storedToken);
        if (cancelled) return;
        setPendingDraft(snapshot);
        setDraftDialogMode("resume");
        setDraftDialogOpen(true);
      } catch {
        if (!cancelled) {
          clearStoredClientOnboardingToken();
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
  }, [onboardingComplete]);

  const progressIndex = getContactOnboardingProgressIndex(phase, contactScreen, draft);

  const destination = useMemo(() => {
    if (phase === "email") return email;
    if (phase === "mobile") return mobile.length === 10 ? `+91 ${mobile}` : "+91 —";
    return "";
  }, [email, mobile, phase]);

  const displayedClientId = resolveInvestorClientCodeDisplay(
    submitResult?.client_id ?? createdClientId,
    email,
    mobile,
  );

  const applyContactUpdate = (snapshot: ClientOnboardingDraftSnapshot) => {
    setDraft(snapshot);
    if (snapshot.email) onEmailChange(snapshot.email);
    if (snapshot.mobile) onMobileChange(snapshot.mobile);
  };

  const handleSendOtp = async () => {
    const valid = phase === "email" ? emailValid : mobileValid;
    if (!valid || sendingOtp) return;
    setError("");
    setSendingOtp(true);
    try {
      if (phase === "email") {
        if (!onboardingToken) {
          const result = await startClientOnboarding(email.trim());
          persistToken(result.onboarding_token);
          setDraft({
            email: email.trim().toLowerCase(),
            email_verified: false,
            mobile: null,
            mobile_verified: false,
            ready_to_create: false,
          });
        } else {
          const normalizedEmail = email.trim().toLowerCase();
          const draftEmail = (draft.email ?? "").toLowerCase();
          if (normalizedEmail !== draftEmail) {
            const result = await updateClientOnboardingContact(onboardingToken, { email: normalizedEmail });
            applyContactUpdate(result);
          } else if (!draft.email_verified) {
            await resendClientOnboardingEmailOtp(onboardingToken);
          } else {
            setContactScreen("verified");
            setSendingOtp(false);
            return;
          }
        }
        onEmailOtpChange("");
        setContactScreen("otp");
      } else {
        if (!onboardingToken) {
          setError("Start with email verification first.");
          return;
        }
        const normalizedMobile = mobile.replace(/\D/g, "").slice(-10);
        if (normalizedMobile !== (draft.mobile ?? "")) {
          const result = await updateClientOnboardingContact(onboardingToken, { mobile: normalizedMobile });
          applyContactUpdate(result);
        } else if (!draft.mobile_verified) {
          await resendClientOnboardingMobileOtp(onboardingToken);
        } else {
          setContactScreen("verified");
          setSendingOtp(false);
          return;
        }
        onMobileOtpChange("");
        setContactScreen("otp");
      }
    } catch (nextError) {
      setError(readApiError(nextError, "Could not send verification code."));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!onboardingToken || sendingOtp) return;
    setError("");
    setSendingOtp(true);
    try {
      if (phase === "email") {
        await resendClientOnboardingEmailOtp(onboardingToken);
        onEmailOtpChange("");
      } else {
        await resendClientOnboardingMobileOtp(onboardingToken);
        onMobileOtpChange("");
      }
    } catch (nextError) {
      setError(readApiError(nextError, "Could not resend verification code."));
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyContactAndAdvance = async () => {
    const otp = phase === "email" ? emailOtp : mobileOtp;
    if (!isValidSixDigitOtp(otp) || verifying) return;
    if (!onboardingToken) {
      setError("Onboarding session expired. Start again from email.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      if (phase === "email") {
        await verifyClientOnboardingEmail(onboardingToken, emailOtp);
        const snapshot = await fetchClientOnboardingDraft(onboardingToken);
        applyDraftSnapshot(snapshot, onboardingToken);
        setPhase("mobile");
        setContactScreen("input");
      } else {
        await verifyClientOnboardingMobile(onboardingToken, mobileOtp);
        const snapshot = await fetchClientOnboardingDraft(onboardingToken);
        applyDraftSnapshot(snapshot, onboardingToken);
        setPhase("account");
        setContactScreen("input");
      }
    } catch (nextError) {
      setError(readApiError(nextError, "Invalid or expired verification code."));
    } finally {
      setVerifying(false);
    }
  };

  const createAccount = async () => {
    if (submitting || onboardingComplete) return;
    if (!onboardingToken) {
      setError("Onboarding session expired. Start again from email.");
      return;
    }
    if (!draft.ready_to_create) {
      setError("Verify both email and mobile before creating the investor account.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await submitClientOnboarding(onboardingToken);
      setSubmitResult(result);
      clearStoredClientOnboardingToken();
      onAccountCreated(result);
    } catch (nextError) {
      setError(readApiError(nextError, "Could not create investor account."));
    } finally {
      setSubmitting(false);
    }
  };

  const requestContactChange = (mode: Extract<DraftDialogMode, "change-email" | "change-mobile">) => {
    setDraftDialogMode(mode);
    setDraftDialogOpen(true);
  };

  const confirmContactChange = () => {
    setDraftDialogOpen(false);
    if (draftDialogMode === "change-email") {
      setPhase("email");
      setContactScreen("input");
      onEmailOtpChange("");
      return;
    }
    if (draftDialogMode === "change-mobile") {
      setPhase("mobile");
      setContactScreen("input");
      onMobileOtpChange("");
    }
  };

  const continueResumeDraft = () => {
    if (!pendingDraft || !readStoredClientOnboardingToken()) {
      setDraftDialogOpen(false);
      return;
    }
    const token = readStoredClientOnboardingToken()!;
    applyDraftSnapshot(pendingDraft, token);
    setPendingDraft(null);
    setDraftDialogOpen(false);
  };

  const discardResumeDraft = async () => {
    const token = readStoredClientOnboardingToken();
    if (token) {
      try {
        await discardClientOnboardingDraft(token);
      } catch {
        // Local discard still proceeds if server draft is already gone.
      }
    }
    clearStoredClientOnboardingToken();
    setPendingDraft(null);
    setDraft(EMPTY_DRAFT);
    persistToken(null);
    setPhase("email");
    setContactScreen("input");
    onEmailChange("");
    onMobileChange("");
    onEmailOtpChange("");
    onMobileOtpChange("");
    setDraftDialogOpen(false);
  };

  const goToPrevious = () => {
    if (phase === "account") {
      setPhase("mobile");
      setContactScreen(draft.mobile_verified ? "verified" : draft.mobile ? "otp" : "input");
      setError("");
      return;
    }
    if (phase === "mobile") {
      if (contactScreen === "otp") {
        setContactScreen(draft.mobile_verified ? "verified" : "input");
        onMobileOtpChange("");
        setError("");
        return;
      }
      setPhase("email");
      setContactScreen(draft.email_verified ? "verified" : "input");
      setError("");
      return;
    }
    if (phase === "email" && contactScreen === "otp") {
      setContactScreen(draft.email_verified ? "verified" : "input");
      onEmailOtpChange("");
      setError("");
    }
  };

  const goToNext = () => {
    if (phase === "email") {
      if (contactScreen === "verified") {
        setPhase("mobile");
        setContactScreen("input");
        return;
      }
      if (contactScreen === "input") {
        void handleSendOtp();
        return;
      }
      void verifyContactAndAdvance();
      return;
    }
    if (phase === "mobile") {
      if (contactScreen === "verified") {
        setPhase("account");
        return;
      }
      if (contactScreen === "input") {
        void handleSendOtp();
        return;
      }
      void verifyContactAndAdvance();
      return;
    }
    if (phase === "account") {
      if (onboardingComplete || submitResult) {
        onFinished();
        return;
      }
      void createAccount();
    }
  };

  const canGoBack =
    (phase === "email" && contactScreen === "otp") ||
    (phase === "mobile" && contactScreen !== "input") ||
    (phase === "mobile" && contactScreen === "input" && draft.email_verified) ||
    phase === "account";

  const primaryDisabled = (() => {
    if (hydrating) return true;
    if (phase === "email") {
      if (contactScreen === "verified") return false;
      if (contactScreen === "input") return !emailValid || sendingOtp;
      return !isValidSixDigitOtp(emailOtp) || verifying;
    }
    if (phase === "mobile") {
      if (contactScreen === "verified") return false;
      if (contactScreen === "input") return !mobileValid || sendingOtp;
      return !isValidSixDigitOtp(mobileOtp) || verifying;
    }
    if (phase === "account") return submitting || (!onboardingComplete && !draft.ready_to_create && !submitResult);
    return true;
  })();

  const primaryLabel = (() => {
    if (phase === "email") {
      if (contactScreen === "verified") return "Continue to mobile";
      if (contactScreen === "input") return sendingOtp ? "Sending…" : "Send code";
      return verifying ? "Verifying…" : "Continue";
    }
    if (phase === "mobile") {
      if (contactScreen === "verified") return "Continue to account";
      if (contactScreen === "input") return sendingOtp ? "Sending…" : "Send code";
      return verifying ? "Verifying…" : "Continue";
    }
    if (phase === "account") {
      if (onboardingComplete || submitResult) return "Continue to KYC";
      return submitting ? "Creating account…" : "Create investor account";
    }
    return "Continue";
  })();

  useWizardKeyboardNavigation({
    onContinue: goToNext,
    onBack: goToPrevious,
    canContinue: !primaryDisabled,
    canBack: canGoBack,
  });

  const PhaseIcon: LucideIcon = phase === "account" ? KeyRound : phase === "email" ? Mail : Phone;

  if (hydrating) {
    return (
      <AddInvestorWizardPanelShell title="Onboarding" className="add-investor-wizard-panel--onboarding">
        <div className="add-investor-onboarding-wizard__center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Checking for saved draft…</p>
        </div>
      </AddInvestorWizardPanelShell>
    );
  }

  return (
    <>
      <AddInvestorWizardPanelShell
        title="Onboarding"
        className="add-investor-wizard-panel--onboarding"
        progress={
          <AddInvestorWizardProgress
            steps={INVESTOR_ONBOARDING_PROGRESS_STEPS}
            activeIndex={progressIndex}
            equalWidth
          />
        }
        footer={
          <AddInvestorWizardStepFooter
            onBack={goToPrevious}
            onContinue={goToNext}
            canBack={canGoBack}
            continueDisabled={primaryDisabled}
            continueLabel={
              sendingOtp && contactScreen === "input" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : verifying && contactScreen === "otp" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Verifying…
                </>
              ) : submitting && phase === "account" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Creating account…
                </>
              ) : (
                primaryLabel
              )
            }
          />
        }
      >
        {(phase === "email" || phase === "mobile") && contactScreen === "verified" ? (
          <div className="add-investor-onboarding-wizard__center">
            <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
              <CheckCircle2 className="size-6 text-emerald-600" strokeWidth={2.25} />
            </span>
            <h3 className="add-investor-onboarding-wizard__title">
              {phase === "email" ? "Email verified" : "Mobile verified"}
            </h3>
            <p className="add-investor-onboarding-wizard__desc">
              {phase === "email"
                ? "This email is saved in your draft. You can continue to mobile or choose a different email."
                : "This mobile number is saved in your draft. Continue to account setup or choose a different number."}
            </p>
            <div className="add-investor-onboarding-wizard__destination">
              <div className="min-w-0 flex-1 text-left">
                <p className="add-investor-onboarding-wizard__destination-label">Verified</p>
                <p className="add-investor-onboarding-wizard__destination-value">{destination}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0"
                aria-label={phase === "email" ? "Change email" : "Change mobile number"}
                onClick={() => requestContactChange(phase === "email" ? "change-email" : "change-mobile")}
              >
                <Pencil className="size-3.5" strokeWidth={2.25} aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}

        {(phase === "email" || phase === "mobile") && contactScreen === "input" ? (
          <div className="add-investor-onboarding-wizard__center">
            <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
              <PhaseIcon className="size-6" strokeWidth={2.25} />
            </span>
            <h3 className="add-investor-onboarding-wizard__title">
              {phase === "email" ? "Verify email" : "Verify mobile"}
            </h3>
            <p className="add-investor-onboarding-wizard__desc">
              {phase === "email"
                ? "Enter the investor email. We will send a one-time code to their inbox."
                : "Enter the Indian mobile number linked to this investor account."}
            </p>
            <div className="add-investor-onboarding-wizard__input-wrap">
              {phase === "mobile" ? (
                <div className="add-investor-phone-input add-investor-onboarding-wizard__phone">
                  <span className="add-investor-phone-input__prefix">+91</span>
                  <Input
                    id="add-investor-onboarding-mobile"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10-digit number"
                    value={mobile}
                    onChange={(event) => onMobileChange(event.target.value)}
                    className="add-investor-phone-input__control h-11"
                  />
                </div>
              ) : (
                <Input
                  id="add-investor-onboarding-email"
                  type="email"
                  autoComplete="email"
                  placeholder="investor@example.com"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value.trim())}
                  className="add-investor-onboarding-wizard__input h-11 text-center"
                />
              )}
            </div>
            {error ? (
              <DistributorFeedbackMessage
                variant="error"
                className="add-distributor-wizard-feedback"
                onDismiss={() => setError("")}
              >
                {error}
              </DistributorFeedbackMessage>
            ) : null}
          </div>
        ) : null}

        {(phase === "email" || phase === "mobile") && contactScreen === "otp" ? (
          <div className="add-investor-onboarding-wizard__center">
            <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
              <PhaseIcon className="size-6" strokeWidth={2.25} />
            </span>
            <h3 className="add-investor-onboarding-wizard__title">Enter verification code</h3>
            <p className="add-investor-onboarding-wizard__desc">
              {phase === "email"
                ? "Check the investor inbox for the 6-digit code."
                : "Enter the SMS code sent to the mobile number."}
            </p>
            <div className="add-investor-onboarding-wizard__destination">
              <div className="min-w-0 flex-1 text-left">
                <p className="add-investor-onboarding-wizard__destination-label">Code sent to</p>
                <p className="add-investor-onboarding-wizard__destination-value">{destination}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0"
                aria-label={phase === "email" ? "Edit email" : "Edit mobile number"}
                onClick={() => requestContactChange(phase === "email" ? "change-email" : "change-mobile")}
              >
                <Pencil className="size-3.5" strokeWidth={2.25} aria-hidden />
              </Button>
            </div>
            <div className="add-investor-onboarding-wizard__otp">
              <AddInvestorOtpField
                id={`add-investor-onboarding-${phase}-otp`}
                value={phase === "email" ? emailOtp : mobileOtp}
                onChange={phase === "email" ? onEmailOtpChange : onMobileOtpChange}
                autoFocus
              />
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-caption"
                disabled={sendingOtp || !onboardingToken}
                onClick={() => void handleResendOtp()}
              >
                Resend code
              </Button>
            </div>
            {error ? (
              <DistributorFeedbackMessage
                variant="error"
                className="add-distributor-wizard-feedback"
                onDismiss={() => setError("")}
              >
                {error}
              </DistributorFeedbackMessage>
            ) : null}
          </div>
        ) : null}

        {phase === "account" ? (
          <div className="add-investor-onboarding-wizard__center add-investor-onboarding-wizard__center--mfa">
            <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
              {submitResult || onboardingComplete ? (
                <CheckCircle2 className="size-6 text-emerald-600" strokeWidth={2.25} />
              ) : (
                <KeyRound className="size-6" strokeWidth={2.25} />
              )}
            </span>
            <h3 className="add-investor-onboarding-wizard__title">
              {submitResult || onboardingComplete ? "Investor account created" : "Create investor account"}
            </h3>
            <p className="add-investor-onboarding-wizard__desc">
              {submitResult || onboardingComplete
                ? "Email and mobile are verified. We emailed the investor a password setup link for their first Zynd sign-in."
                : "Both email and mobile must be verified before the investor is created and added to your book."}
            </p>
            {submitResult || (onboardingComplete && displayedClientId !== "—") ? (
              <div className="add-investor-onboarding-wizard__destination">
                <div className="min-w-0 flex-1 text-left">
                  <p className="add-investor-onboarding-wizard__destination-label">Investor code</p>
                  <p className="add-investor-onboarding-wizard__destination-value">
                    {displayedClientId}
                  </p>
                </div>
              </div>
            ) : null}
            {error ? (
              <DistributorFeedbackMessage
                variant="error"
                className="add-distributor-wizard-feedback"
                onDismiss={() => setError("")}
              >
                {error}
              </DistributorFeedbackMessage>
            ) : null}
          </div>
        ) : null}
      </AddInvestorWizardPanelShell>

      <AddInvestorOnboardingDraftDialog
        open={draftDialogOpen}
        mode={draftDialogMode}
        email={pendingDraft?.email ?? draft.email ?? email}
        mobile={pendingDraft?.mobile ?? draft.mobile ?? mobile}
        onOpenChange={setDraftDialogOpen}
        onConfirm={
          draftDialogMode === "resume"
            ? continueResumeDraft
            : confirmContactChange
        }
        onDiscard={draftDialogMode === "resume" ? () => void discardResumeDraft() : undefined}
      />
    </>
  );
}
