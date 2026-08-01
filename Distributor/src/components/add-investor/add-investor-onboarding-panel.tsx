"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Fingerprint, Loader2, Mail, Pencil, Phone, QrCode } from "lucide-react";

import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";

import { AddInvestorOtpField } from "@/components/add-investor/add-investor-otp-field";
import { AddInvestorWizardPanelShell } from "@/components/add-investor/add-investor-wizard-panel-shell";
import { AddInvestorWizardProgress } from "@/components/add-investor/add-investor-wizard-progress";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ADD_INVESTOR_DEMO_OTP } from "@/lib/add-investor/add-investor-journey";
import { delay } from "@/lib/add-investor/add-investor-demo";
import {
  getContactOnboardingProgressIndex,
  INVESTOR_ONBOARDING_PROGRESS_STEPS,
} from "@/lib/add-investor/add-investor-onboarding-progress";

type OnboardingPhase = "email" | "mobile" | "mfa";
type ContactScreen = "input" | "otp";

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
  mfaBound: boolean;
  onMfaBoundChange: (value: boolean) => void;
  mfaCode: string;
  onMfaCodeChange: (value: string) => void;
  onFinished: () => void;
};

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
  mfaBound,
  onMfaBoundChange,
  mfaCode,
  onMfaCodeChange,
  onFinished,
}: AddInvestorOnboardingPanelProps) {
  const [phase, setPhase] = useState<OnboardingPhase>("email");
  const [contactScreen, setContactScreen] = useState<ContactScreen>("input");
  const [sendingOtp, setSendingOtp] = useState(false);

  const progressIndex = getContactOnboardingProgressIndex(phase, contactScreen);
  const emailVerified = emailOtp === ADD_INVESTOR_DEMO_OTP;
  const mobileVerified = mobileOtp === ADD_INVESTOR_DEMO_OTP;
  const mfaComplete = mfaBound && mfaCode.length === 6;

  const destination = useMemo(() => {
    if (phase === "email") return email;
    if (phase === "mobile") return mobile.length === 10 ? `+91 ${mobile}` : "+91 —";
    return "";
  }, [email, mobile, phase]);

  const handleSendOtp = async () => {
    const valid = phase === "email" ? emailValid : mobileValid;
    if (!valid) return;
    setSendingOtp(true);
    await delay(500);
    setSendingOtp(false);
    setContactScreen("otp");
    if (phase === "email") onEmailOtpChange("");
    if (phase === "mobile") onMobileOtpChange("");
  };

  const handleEditDestination = () => {
    setContactScreen("input");
    if (phase === "email") onEmailOtpChange("");
    if (phase === "mobile") onMobileOtpChange("");
  };

  const goToPrevious = () => {
    if (phase === "mfa") {
      setPhase("mobile");
      setContactScreen("otp");
      return;
    }
    if (phase === "mobile" && contactScreen === "otp") {
      setContactScreen("input");
      onMobileOtpChange("");
      return;
    }
    if (phase === "mobile" && contactScreen === "input") {
      setPhase("email");
      setContactScreen("otp");
      return;
    }
    if (phase === "email" && contactScreen === "otp") {
      setContactScreen("input");
      onEmailOtpChange("");
    }
  };

  const goToNext = () => {
    if (phase === "email" && contactScreen === "input") {
      void handleSendOtp();
      return;
    }
    if (phase === "email" && contactScreen === "otp" && emailVerified) {
      setPhase("mobile");
      setContactScreen("input");
      return;
    }
    if (phase === "mobile" && contactScreen === "input") {
      void handleSendOtp();
      return;
    }
    if (phase === "mobile" && contactScreen === "otp" && mobileVerified) {
      setPhase("mfa");
      return;
    }
    if (phase === "mfa" && mfaComplete) {
      onFinished();
    }
  };

  const canGoBack =
    (phase === "email" && contactScreen === "otp") ||
    phase === "mobile" ||
    phase === "mfa";

  const primaryDisabled = (() => {
    if (phase === "email" && contactScreen === "input") return !emailValid || sendingOtp;
    if (phase === "email" && contactScreen === "otp") return !emailVerified;
    if (phase === "mobile" && contactScreen === "input") return !mobileValid || sendingOtp;
    if (phase === "mobile" && contactScreen === "otp") return !mobileVerified;
    if (phase === "mfa") return !mfaComplete;
    return true;
  })();

  const primaryLabel = (() => {
    if (phase === "email" && contactScreen === "input") return sendingOtp ? "Sending…" : "Send code";
    if (phase === "mobile" && contactScreen === "input") return sendingOtp ? "Sending…" : "Send code";
    if (phase === "mfa") return "Complete onboarding";
    return "Continue";
  })();

  useWizardKeyboardNavigation({
    onContinue: goToNext,
    onBack: goToPrevious,
    canContinue: !primaryDisabled,
    canBack: canGoBack,
  });

  const PhaseIcon =
    phase === "mfa" ? Fingerprint : phase === "email" ? Mail : Phone;

  return (
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
            ) : (
              primaryLabel
            )
          }
        />
      }
    >
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
          </div>
        ) : null}

        {(phase === "email" || phase === "mobile") && contactScreen === "otp" ? (
          <div className="add-investor-onboarding-wizard__center">
            <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
              <PhaseIcon className="size-6" strokeWidth={2.25} />
            </span>
            <h3 className="add-investor-onboarding-wizard__title">Enter verification code</h3>
            <p className="add-investor-onboarding-wizard__desc">
              {phase === "email" ? "Check the investor inbox for the 6-digit code." : "Enter the SMS code sent to the mobile number."}
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
                onClick={handleEditDestination}
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
              <p className="add-investor-onboarding-wizard__hint">
                Demo code:{" "}
                <span className="font-mono font-medium text-foreground">{ADD_INVESTOR_DEMO_OTP}</span>
              </p>
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-caption"
                disabled={sendingOtp || (phase === "email" ? !emailValid : !mobileValid)}
                onClick={() => void handleSendOtp()}
              >
                Resend code
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "mfa" ? (
          <div className="add-investor-onboarding-wizard__mfa">
            <div className="add-investor-onboarding-wizard__center add-investor-onboarding-wizard__center--mfa">
              <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
                <Fingerprint className="size-6" strokeWidth={2.25} />
              </span>
              <h3 className="add-investor-onboarding-wizard__title">Enable authenticator</h3>
              <p className="add-investor-onboarding-wizard__desc">
                Scan the QR code in the investor authenticator app, then enter a 6-digit code to finish onboarding.
              </p>
            </div>
            <div className="add-investor-onboarding-wizard__mfa-grid">
              <div className="add-investor-onboarding-wizard__mfa-setup">
                <div className="add-investor-onboarding-wizard__mfa-qr" aria-hidden>
                  <QrCode className="size-16 text-muted-foreground/70" strokeWidth={1.25} />
                </div>
                <div className="add-investor-onboarding-wizard__mfa-secret">
                  <p className="add-investor-onboarding-wizard__mfa-secret-label">Demo secret</p>
                  <p className="add-investor-onboarding-wizard__mfa-secret-value">ZYND-DIST-DEMO-MFA-KEY</p>
                  <div className="add-investor-onboarding-wizard__mfa-bound">
                    <Switch
                      id="add-investor-mfa-bound"
                      checked={mfaBound}
                      onCheckedChange={onMfaBoundChange}
                    />
                    <Label htmlFor="add-investor-mfa-bound" className="text-caption">
                      Investor added this account to their authenticator
                    </Label>
                  </div>
                </div>
              </div>
              <div className="add-investor-onboarding-wizard__mfa-otp">
                <FieldLabel>Authenticator code</FieldLabel>
                <AddInvestorOtpField
                  id="add-investor-mfa-otp"
                  value={mfaCode}
                  onChange={onMfaCodeChange}
                  disabled={!mfaBound}
                  autoFocus={mfaBound}
                />
              </div>
            </div>
          </div>
        ) : null}
    </AddInvestorWizardPanelShell>
  );
}
