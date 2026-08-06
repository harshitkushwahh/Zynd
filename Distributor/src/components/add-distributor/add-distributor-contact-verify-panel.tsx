"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Mail, Pencil, Phone } from "lucide-react";

import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";

import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorOtpField } from "@/components/add-investor/add-investor-otp-field";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Button } from "@/components/ui/button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { Input } from "@/components/ui/input";
import { isValidSixDigitOtp } from "@/lib/add-investor/add-investor-journey";
import {
  resendPartnerOnboardingEmailOtp,
  resendPartnerOnboardingMobileOtp,
  sendPartnerOnboardingMobileOtp,
  startPartnerOnboarding,
  verifyPartnerOnboardingEmail,
  verifyPartnerOnboardingMobile,
} from "@/lib/distributor-partners-api";
import { ApiError } from "@/lib/api-client";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type ContactChannel = "email" | "mobile";
type ContactScreen = "input" | "otp";

const CHANNEL_META: Record<
  ContactChannel,
  {
    stepId: "email" | "mobile";
    title: string;
    inputTitle: string;
    inputDesc: string;
    otpDesc: string;
    icon: LucideIcon;
    placeholder: string;
    editLabel: string;
  }
> = {
  email: {
    stepId: "email",
    title: "Onboarding",
    inputTitle: "Verify email",
    inputDesc: ZYND_MITRA_COPY.workEmailDesc,
    otpDesc: ZYND_MITRA_COPY.inboxOtpDesc,
    icon: Mail,
    placeholder: "distributor@example.com",
    editLabel: "Edit email",
  },
  mobile: {
    stepId: "mobile",
    title: "Onboarding",
    inputTitle: "Verify mobile",
    inputDesc: ZYND_MITRA_COPY.mobileDesc,
    otpDesc: "Enter the SMS code sent to the mobile number.",
    icon: Phone,
    placeholder: "10-digit number",
    editLabel: "Edit mobile number",
  },
};

type AddDistributorContactVerifyPanelProps = {
  channel: ContactChannel;
  onboardingToken: string | null;
  onOnboardingTokenChange: (token: string) => void;
  value: string;
  onValueChange: (value: string) => void;
  otp: string;
  onOtpChange: (value: string) => void;
  inputValid: boolean;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
};

function readApiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  return fallback;
}

export function AddDistributorContactVerifyPanel({
  channel,
  onboardingToken,
  onOnboardingTokenChange,
  value,
  onValueChange,
  otp,
  onOtpChange,
  inputValid,
  onBack,
  onContinue,
  canBack,
}: AddDistributorContactVerifyPanelProps) {
  const meta = CHANNEL_META[channel];
  const [screen, setScreen] = useState<ContactScreen>("input");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const verified = isValidSixDigitOtp(otp);
  const PhaseIcon = meta.icon;

  const destination =
    channel === "email" ? value : value.length === 10 ? `+91 ${value}` : "+91 —";

  const handleSendOtp = async () => {
    if (!inputValid || sendingOtp) return;
    setError("");
    setSendingOtp(true);
    try {
      if (channel === "email") {
        if (onboardingToken) {
          await resendPartnerOnboardingEmailOtp(onboardingToken);
        } else {
          const result = await startPartnerOnboarding(value.trim());
          onOnboardingTokenChange(result.onboarding_token);
        }
      } else {
        if (!onboardingToken) {
          setError("Start with email verification first.");
          return;
        }
        await sendPartnerOnboardingMobileOtp(onboardingToken, value);
      }
      setScreen("otp");
      onOtpChange("");
    } catch (nextError) {
      setError(readApiError(nextError, "Could not send verification code."));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!inputValid || sendingOtp || !onboardingToken) return;
    setError("");
    setSendingOtp(true);
    try {
      if (channel === "email") {
        await resendPartnerOnboardingEmailOtp(onboardingToken);
      } else {
        await resendPartnerOnboardingMobileOtp(onboardingToken);
      }
      onOtpChange("");
    } catch (nextError) {
      setError(readApiError(nextError, "Could not resend verification code."));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleEditDestination = () => {
    setScreen("input");
    onOtpChange("");
    setError("");
  };

  const verifyAndContinue = async () => {
    if (!verified || verifying) return;
    if (channel === "mobile" && !onboardingToken) {
      setError("Onboarding session expired. Start again from email.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      if (channel === "email") {
        if (!onboardingToken) {
          setError("Onboarding session expired. Start again.");
          return;
        }
        await verifyPartnerOnboardingEmail(onboardingToken, otp);
      } else {
        await verifyPartnerOnboardingMobile(onboardingToken!, otp);
      }
      onContinue();
    } catch (nextError) {
      setError(readApiError(nextError, "Invalid or expired verification code."));
    } finally {
      setVerifying(false);
    }
  };

  const goToPrevious = () => {
    if (screen === "otp") {
      setScreen("input");
      onOtpChange("");
      setError("");
      return;
    }
    onBack();
  };

  const goToNext = () => {
    if (screen === "input") {
      void handleSendOtp();
      return;
    }
    void verifyAndContinue();
  };

  const primaryDisabled =
    screen === "input"
      ? !inputValid || sendingOtp
      : !verified || verifying;

  const primaryLabel =
    screen === "input"
      ? sendingOtp
        ? "Sending…"
        : "Send code"
      : verifying
        ? "Verifying…"
        : "Continue";

  useWizardKeyboardNavigation({
    onContinue: goToNext,
    onBack: goToPrevious,
    canContinue: !primaryDisabled,
    canBack: screen === "otp" || canBack,
  });

  return (
    <AddDistributorWizardPanelShell
      stepId={meta.stepId}
      title={meta.title}
      className="add-investor-wizard-panel--onboarding"
      footer={
        <AddInvestorWizardStepFooter
          onBack={goToPrevious}
          onContinue={goToNext}
          canBack={screen === "otp" || canBack}
          continueDisabled={primaryDisabled}
          continueLabel={
            sendingOtp && screen === "input" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : verifying && screen === "otp" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Verifying…
              </>
            ) : (
              primaryLabel
            )
          }
        />
      }
    >
      {screen === "input" ? (
        <div className="add-investor-onboarding-wizard__center">
          <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
            <PhaseIcon className="size-6" strokeWidth={2.25} />
          </span>
          <h3 className="add-investor-onboarding-wizard__title">{meta.inputTitle}</h3>
          <p className="add-investor-onboarding-wizard__desc">{meta.inputDesc}</p>
          <div className="add-investor-onboarding-wizard__input-wrap">
            {channel === "mobile" ? (
              <div className="add-investor-phone-input add-investor-onboarding-wizard__phone">
                <span className="add-investor-phone-input__prefix">+91</span>
                <Input
                  id={`add-distributor-${channel}`}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder={meta.placeholder}
                  value={value}
                  onChange={(event) => onValueChange(event.target.value)}
                  className="add-investor-phone-input__control h-11"
                />
              </div>
            ) : (
              <Input
                id={`add-distributor-${channel}`}
                type="email"
                autoComplete="email"
                placeholder={meta.placeholder}
                value={value}
                onChange={(event) => onValueChange(event.target.value.trim())}
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
      ) : (
        <div className="add-investor-onboarding-wizard__center">
          <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
            <PhaseIcon className="size-6" strokeWidth={2.25} />
          </span>
          <h3 className="add-investor-onboarding-wizard__title">Enter verification code</h3>
          <p className="add-investor-onboarding-wizard__desc">{meta.otpDesc}</p>
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
              aria-label={meta.editLabel}
              onClick={handleEditDestination}
            >
              <Pencil className="size-3.5" strokeWidth={2.25} aria-hidden />
            </Button>
          </div>
          <div className="add-investor-onboarding-wizard__otp">
            <AddInvestorOtpField
              id={`add-distributor-${channel}-otp`}
              value={otp}
              onChange={onOtpChange}
              autoFocus
            />
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-caption"
              disabled={sendingOtp || !inputValid || !onboardingToken}
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
      )}
    </AddDistributorWizardPanelShell>
  );
}
