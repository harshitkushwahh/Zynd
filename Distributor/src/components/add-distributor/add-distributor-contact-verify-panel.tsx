"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Mail, Pencil, Phone } from "lucide-react";

import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";

import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorOtpField } from "@/components/add-investor/add-investor-otp-field";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADD_DISTRIBUTOR_DEMO_OTP } from "@/lib/add-distributor/add-distributor-journey";
import { delay } from "@/lib/add-investor/add-investor-demo";
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
  value: string;
  onValueChange: (value: string) => void;
  otp: string;
  onOtpChange: (value: string) => void;
  inputValid: boolean;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
};

export function AddDistributorContactVerifyPanel({
  channel,
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
  const verified = otp === ADD_DISTRIBUTOR_DEMO_OTP;
  const PhaseIcon = meta.icon;

  const destination =
    channel === "email" ? value : value.length === 10 ? `+91 ${value}` : "+91 —";

  const handleSendOtp = async () => {
    if (!inputValid) return;
    setSendingOtp(true);
    await delay(500);
    setSendingOtp(false);
    setScreen("otp");
    onOtpChange("");
  };

  const handleEditDestination = () => {
    setScreen("input");
    onOtpChange("");
  };

  const goToPrevious = () => {
    if (screen === "otp") {
      setScreen("input");
      onOtpChange("");
      return;
    }
    onBack();
  };

  const goToNext = () => {
    if (screen === "input") {
      void handleSendOtp();
      return;
    }
    if (verified) {
      onContinue();
    }
  };

  const primaryDisabled =
    screen === "input" ? !inputValid || sendingOtp : !verified;

  const primaryLabel =
    screen === "input" ? (sendingOtp ? "Sending…" : "Send code") : "Continue";

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
            <p className="add-investor-onboarding-wizard__hint">
              Demo code:{" "}
              <span className="font-mono font-medium text-foreground">{ADD_DISTRIBUTOR_DEMO_OTP}</span>
            </p>
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-caption"
              disabled={sendingOtp || !inputValid}
              onClick={() => void handleSendOtp()}
            >
              Resend code
            </Button>
          </div>
        </div>
      )}
    </AddDistributorWizardPanelShell>
  );
}
