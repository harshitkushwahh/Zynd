"use client";

import { Check, Info, ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { AuthSubmitFooter, OtpInput } from "@/components/auth/auth-shared";
import { PinInput } from "@/features/account/pin/components/pin-input";
import { ZyndPinResetHeroImage } from "@/features/account/pin/components/zynd-pin-reset-hero-image";
import {
  resetZyndPinWithOtp,
  sendZyndPinResetOtp,
} from "@/features/account/pin/api/pin-api";
import { Button } from "@/components/ui/button";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { useZyndPinOptional } from "@/contexts/zynd-pin-context";
import { ApiError } from "@/lib/api-client";
import { appConfig } from "@/shared/config/app-config";
import { storageKeys } from "@/shared/config/storage-keys";
import { copy } from "@/shared/config/copy";
import { useOtpResendCooldown } from "@/hooks/use-otp-resend-cooldown";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { cn } from "@/lib/utils";

type ForgotStep = "intro" | "verify" | "pin";

const STEPS: ForgotStep[] = ["intro", "verify", "pin"];

const STEP_COPY: Record<ForgotStep, { title: string }> = {
  intro: { title: copy.pin.forgotTitle },
  verify: { title: copy.pin.setupSteps.verifyTitle },
  pin: { title: copy.pin.setupSteps.pinTitle },
};

const INTRO_POINTS = [
  {
    icon: Check,
    tone: "primary" as const,
    text: copy.pin.setupSteps.pinDescription,
  },
  {
    icon: Info,
    tone: "info" as const,
    text: copy.pin.setupVerifyHint,
  },
];

type PinForgotProgressProps = {
  step: ForgotStep;
  compact?: boolean;
};

function PinForgotProgress({ step, compact = false }: PinForgotProgressProps) {
  const currentIndex = STEPS.indexOf(step);

  return (
    <div className={cn("flex gap-1.5", compact ? "mb-1" : "mb-3")}>
      {STEPS.map((item, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div
            key={item}
            className={cn(
              "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
              done && "bg-success",
              active && "bg-primary",
              !done && !active && "bg-border",
            )}
          />
        );
      })}
    </div>
  );
}

type ZyndPinForgotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ZyndPinForgotDialog({ open, onOpenChange }: ZyndPinForgotDialogProps) {
  const { refreshUser } = useAuth();
  const pinContext = useZyndPinOptional();
  const [step, setStep] = useState<ForgotStep>("intro");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const cooldown = useOtpResendCooldown(storageKeys.pinResetOtpCooldown);
  const sendingOtpRef = useRef(false);

  const resetState = useCallback(() => {
    setStep("intro");
    setOtp("");
    setPin("");
    setConfirmPin("");
    setError("");
    setLoading(false);
    setOtpSent(false);
  }, []);

  useResetWhenDialogOpens(open, resetState);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const sendOtp = async () => {
    if (sendingOtpRef.current) return otpSent;

    sendingOtpRef.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await sendZyndPinResetOtp();
      cooldown.startCooldown(result.retry_after_seconds);
      setOtpSent(true);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "otp_cooldown") {
        cooldown.syncFromError(err.retryAfterSeconds);
        setOtpSent(true);
        return true;
      }
      setError(err instanceof ApiError ? err.message : copy.pin.couldNotReset);
      return false;
    } finally {
      sendingOtpRef.current = false;
      setLoading(false);
    }
  };

  const handleIntroContinue = async () => {
    const sent = await sendOtp();
    if (sent) setStep("verify");
  };

  const handleVerifyContinue = () => {
    if (otp.length !== appConfig.otpLength) return;
    setError("");
    setStep("pin");
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pin !== confirmPin) {
      setError(copy.pin.pinMismatch);
      return;
    }
    if (pin.length !== appConfig.pinLength) return;

    setLoading(true);
    setError("");
    try {
      await resetZyndPinWithOtp({ otp, pin, confirmPin });
      await refreshUser();
      pinContext?.markUnlocked();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.pin.couldNotReset);
    } finally {
      setLoading(false);
    }
  };

  const pinsMatch = pin.length === appConfig.pinLength && confirmPin.length === appConfig.pinLength && pin === confirmPin;
  const pinsMismatch =
    pin.length === appConfig.pinLength &&
    confirmPin.length === appConfig.pinLength &&
    pin !== confirmPin;

  const { title } = STEP_COPY[step];

  return (
    <BrandDialog open={open} onOpenChange={handleOpenChange} title={title} maxWidth="lg">
      <div className={cn("px-5 pb-5", step === "intro" ? "pt-4" : "pt-1.5")}>
        <PinForgotProgress step={step} compact={step !== "intro"} />

        {step === "intro" ? (
          <div className="space-y-5">
            <ZyndPinResetHeroImage />

            <ul className="space-y-2.5">
              {INTRO_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.text} className="flex items-start gap-2.5 text-compact text-muted-foreground">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        point.tone === "primary" && "bg-primary/10 text-primary",
                        point.tone === "info" && "bg-info/10 text-info",
                      )}
                    >
                      <Icon className="size-3" strokeWidth={2.5} aria-hidden />
                    </span>
                    {point.text}
                  </li>
                );
              })}
            </ul>

            <FieldMessage message={error} />

            <AuthSubmitFooter className="pt-0">
              <Button
                type="button"
                className="w-full"
                disabled={loading}
                onClick={() => void handleIntroContinue()}
              >
                {loading ? copy.mfa.preparing : copy.mfa.continue}
              </Button>
            </AuthSubmitFooter>
          </div>
        ) : null}

        {step === "verify" ? (
          <div className="space-y-4">
            <ZyndPinResetHeroImage />

            <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
              <div className="space-y-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="size-4 text-primary" strokeWidth={2.25} aria-hidden />
                  <Label htmlFor="pin-reset-otp" className="text-caption font-medium">
                    Email verification code
                  </Label>
                </div>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {copy.pin.forgotDescription}
                </p>
                <OtpInput
                  id="pin-reset-otp"
                  value={otp}
                  error={!!error}
                  onChange={(value) => {
                    setOtp(value);
                    if (error) setError("");
                  }}
                />
                {otpSent ? (
                  <div className="flex justify-center pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground"
                      disabled={!cooldown.canResend || loading}
                      onClick={() => void sendOtp()}
                    >
                      {cooldown.canResend
                        ? copy.pin.sendResetCode
                        : `Resend in ${cooldown.secondsLeft}s`}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <FieldMessage message={error} className="text-center" />

            <AuthSubmitFooter className="pt-0">
              <Button
                type="button"
                className="w-full"
                disabled={loading || otp.length !== appConfig.otpLength}
                onClick={handleVerifyContinue}
              >
                {copy.mfa.continue}
              </Button>
            </AuthSubmitFooter>
          </div>
        ) : null}

        {step === "pin" ? (
          <form className="mt-2 space-y-4" onSubmit={handleReset}>
            <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
              <div className="space-y-5">
                <div>
                  <p className="mb-3 text-center text-caption font-medium text-foreground">
                    {copy.pin.setupStepCreate}
                  </p>
                  <PinInput value={pin} onChange={setPin} autoFocus />
                </div>

                <div className="border-t border-border pt-5">
                  <p className="mb-3 text-center text-caption font-medium text-foreground">
                    {copy.pin.setupStepConfirm}
                  </p>
                  <PinInput
                    value={confirmPin}
                    onChange={setConfirmPin}
                    error={pinsMismatch || !!error}
                  />
                  {pinsMatch ? (
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-caption text-success">
                      <Check className="size-3.5" strokeWidth={2.5} />
                      PINs match
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <FieldMessage message={error} />

            <AuthSubmitFooter className="pt-0">
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !pinsMatch || otp.length !== appConfig.otpLength}
              >
                {loading ? copy.mfa.verifying : copy.pin.resetButton}
              </Button>
            </AuthSubmitFooter>
          </form>
        ) : null}
      </div>
    </BrandDialog>
  );
}
