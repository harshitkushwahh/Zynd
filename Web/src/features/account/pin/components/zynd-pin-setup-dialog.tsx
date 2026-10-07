"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Fingerprint, Lock, ShieldCheck } from "lucide-react";

import { OtpInput } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { SplitFormDialog } from "@/components/ui/split-form-dialog";
import { SplitFormStepProgress, type SplitFormStepItem } from "@/components/ui/split-form-step-progress";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { PinInput } from "@/features/account/pin/components/pin-input";
import { ZyndPinSetupHeroImage } from "@/features/account/pin/components/zynd-pin-setup-hero-image";
import { setupZyndPin } from "@/features/account/pin/api/pin-api";
import {
  isPlatformBiometricAvailable,
  registerPinBiometricUnlock,
} from "@/features/account/pin/lib/pin-biometric";
import { useAuth } from "@/contexts/auth-context";
import { useZyndPinOptional } from "@/contexts/zynd-pin-context";
import { ApiError } from "@/lib/api-client";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";

type SetupStep = "pin" | "verify" | "done";

const PIN_STEPS: SplitFormStepItem[] = [
  { step: 1, label: "Create PIN" },
  { step: 2, label: "Verify identity" },
];

const STEP_NUMBER: Record<SetupStep, number> = {
  pin: 1,
  verify: 2,
  done: 2,
};

const START_FEATURE_ICONS = [
  { icon: ShieldCheck, iconClassName: "bg-primary/10 text-primary" },
  { icon: Lock, iconClassName: "bg-success/10 text-success" },
] as const;

const VERIFY_POINT_ICONS = [
  { icon: Lock, iconClassName: "bg-primary/10 text-primary" },
  { icon: ShieldCheck, iconClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
] as const;

type ZyndPinSetupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function ZyndPinSetupDialog({ open, onOpenChange, onCompleted }: ZyndPinSetupDialogProps) {
  const { refreshUser, user } = useAuth();
  const pinContext = useZyndPinOptional();
  const [step, setStep] = useState<SetupStep>("pin");
  const [currentPassword, setCurrentPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const pinComplete = pin.length === appConfig.pinLength;
  const confirmComplete = confirmPin.length === appConfig.pinLength;
  const pinsMatch = pinComplete && confirmComplete && pin === confirmPin;
  const pinsMismatch = pinComplete && confirmComplete && pin !== confirmPin;

  const resetState = useCallback(() => {
    setStep("pin");
    setCurrentPassword("");
    setTotpCode("");
    setPin("");
    setConfirmPin("");
    setError("");
    setLoading(false);
    setBiometricLoading(false);
    setBiometricEnabled(false);
  }, []);

  useResetWhenDialogOpens(open, resetState);

  useEffect(() => {
    if (!open) return;
    void isPlatformBiometricAvailable().then(setBiometricAvailable);
  }, [open]);

  const dialogTitle = useMemo(() => {
    if (step === "pin") return copy.pin.setupSteps.pinTitle;
    if (step === "verify") return copy.pin.setupSteps.verifyTitle;
    return copy.pin.setupSteps.successTitle;
  }, [step]);

  const points = useMemo(() => {
    if (step === "done") {
      return copy.pin.setupFeaturePoints.map((point, index) => ({
        ...point,
        icon: START_FEATURE_ICONS[index]?.icon ?? ShieldCheck,
        iconClassName: START_FEATURE_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
      }));
    }
    if (step === "verify") {
      return copy.pin.verifyIntroPoints.map((point, index) => ({
        ...point,
        icon: VERIFY_POINT_ICONS[index]?.icon ?? Lock,
        iconClassName: VERIFY_POINT_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
      }));
    }
    return copy.pin.setupFeaturePoints.map((point, index) => ({
      ...point,
      icon: START_FEATURE_ICONS[index]?.icon ?? ShieldCheck,
      iconClassName: START_FEATURE_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
    }));
  }, [step]);

  const handlePinContinue = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (pinsMismatch) {
      setError(copy.pin.pinMismatch);
      return;
    }
    if (!pinsMatch) return;
    setStep("verify");
  };

  const handleSetupSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentPassword || totpCode.length !== appConfig.otpLength || !pinsMatch) return;

    setLoading(true);
    setError("");
    try {
      await setupZyndPin({
        currentPassword,
        totpCode,
        pin,
        confirmPin,
      });
      await refreshUser();
      pinContext?.markUnlocked();
      setStep("done");
      onCompleted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.pin.couldNotSetup);
    } finally {
      setLoading(false);
    }
  };

  const verifyReady = Boolean(currentPassword) && totpCode.length === appConfig.otpLength;

  return (
    <SplitFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      gridClassName={
        step === "pin" ? "max-h-[min(90vh,30rem)]" : "max-h-[min(90vh,34rem)]"
      }
      centerContent={step === "pin"}
      contentClassName={step === "pin" ? "pt-5 sm:pt-6" : undefined}
      illustration={
        <ZyndPinSetupHeroImage className="w-full max-w-[13rem] sm:max-w-sm" />
      }
      rightHeader={
        step === "done" ? null : (
          <SplitFormStepProgress steps={PIN_STEPS} currentStep={STEP_NUMBER[step]} />
        )
      }
      points={points}
      footer={
        step === "pin" ? (
          <Button
            type="submit"
            form="zynd-pin-create-form"
            className="h-11 w-full rounded-full px-5 sm:w-auto"
            disabled={!pinsMatch}
          >
            {copy.mfa.continue}
          </Button>
        ) : step === "verify" ? (
          <Button
            type="submit"
            form="zynd-pin-verify-form"
            className="h-11 w-full rounded-full px-5 sm:w-auto"
            disabled={loading || !verifyReady}
          >
            {loading ? copy.mfa.verifying : copy.pin.setUpButton}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 w-full rounded-full px-5 sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        )
      }
    >
      {step === "pin" ? (
        <form
          id="zynd-pin-create-form"
          className="mx-auto flex w-full min-w-0 max-w-[18rem] flex-col gap-6"
          onSubmit={handlePinContinue}
        >
            <div className="space-y-2.5 text-center">
              <p className="text-caption font-medium text-foreground">{copy.pin.setupStepCreate}</p>
              <PinInput value={pin} onChange={setPin} autoFocus compact />
            </div>

            <div className="space-y-2.5 text-center">
              <p
                className={
                  pinComplete
                    ? "text-caption font-medium text-foreground"
                    : "text-caption font-medium text-muted-foreground"
                }
              >
                {copy.pin.setupStepConfirm}
              </p>
              <PinInput
                value={confirmPin}
                onChange={setConfirmPin}
                error={pinsMismatch}
                success={pinsMatch}
                compact
                disabled={!pinComplete}
              />
              <div className="flex min-h-[1.75rem] items-center justify-center">
                {pinsMatch ? (
                  <StatusBadge variant="success">{copy.pin.pinsMatchBadge}</StatusBadge>
                ) : pinsMismatch ? (
                  <FieldMessage message={copy.pin.pinMismatch} className="text-center" />
                ) : null}
              </div>
            </div>
        </form>
      ) : null}

      {step === "verify" ? (
        <form id="zynd-pin-verify-form" className="min-w-0 space-y-4" onSubmit={handleSetupSubmit}>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="zynd-pin-password" className="text-caption font-medium">
              {copy.pin.setupStepPassword}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <PasswordInput
              id="zynd-pin-password"
              icon={Lock}
              autoComplete="current-password"
              placeholder={copy.settings.changePasswordCurrentPlaceholder}
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                if (error) setError("");
              }}
              className="h-11 w-full min-w-0 max-w-full bg-background"
              autoFocus
            />
          </div>

          <div className="min-w-0 space-y-2 border-t border-border/60 pt-4">
            <Label htmlFor="zynd-pin-totp" className="text-caption font-medium">
              {copy.pin.setupStepMfa}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <div className="w-full max-w-[17.5rem] [&>div>div]:gap-1.5 [&_input]:h-9 [&_input]:text-compact [&_input]:shadow-none">
              <OtpInput
                id="zynd-pin-totp"
                value={totpCode}
                onChange={(value) => {
                  setTotpCode(value);
                  if (error) setError("");
                }}
                error={!!error}
              />
            </div>
            {error ? <FieldMessage message={error} /> : null}
          </div>
        </form>
      ) : null}

      {step === "done" ? (
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-success/25 bg-success/5 px-3 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-compact font-semibold text-foreground">{copy.pin.setupSteps.successTitle}</p>
              <p className="mt-0.5 text-caption text-muted-foreground">{copy.pin.setupSteps.successDescription}</p>
            </div>
          </div>

          {biometricAvailable && !biometricEnabled ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-full"
              disabled={biometricLoading || !user?.id}
              onClick={async () => {
                if (!user?.id) return;
                setBiometricLoading(true);
                setError("");
                try {
                  await registerPinBiometricUnlock(user.id);
                  setBiometricEnabled(true);
                  onCompleted?.();
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : copy.pin.biometricCouldNotEnable);
                } finally {
                  setBiometricLoading(false);
                }
              }}
            >
              <Fingerprint className="size-4" />
              {biometricLoading ? copy.mfa.verifying : copy.pin.biometricEnableButton}
            </Button>
          ) : null}

          {biometricEnabled ? (
            <UiMessage variant="success" message={copy.pin.biometricEnabledLabel} className="mt-0" />
          ) : null}

          <FieldMessage message={error} className="text-center" />
        </div>
      ) : null}
    </SplitFormDialog>
  );
}
