"use client";

import { useEffect, useState } from "react";
import { Check, Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

import { PinInput } from "@/features/account/pin/components/pin-input";
import { setupZyndPin } from "@/features/account/pin/api/pin-api";
import {
  isPlatformBiometricAvailable,
  registerPinBiometricUnlock,
} from "@/features/account/pin/lib/pin-biometric";
import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/auth/auth-shared";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { useZyndPinOptional } from "@/contexts/zynd-pin-context";
import { ApiError } from "@/lib/api-client";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type SetupStep = "verify" | "pin" | "done";

const STEPS: { id: Exclude<SetupStep, "done">; label: string }[] = [
  { id: "verify", label: "Verify identity" },
  { id: "pin", label: "Create PIN" },
];

const STEP_COPY: Record<SetupStep, { title: string; description: string }> = {
  verify: {
    title: copy.pin.setupSteps.verifyTitle,
    description: copy.pin.setupSteps.verifyDescription,
  },
  pin: {
    title: copy.pin.setupSteps.pinTitle,
    description: copy.pin.setupSteps.pinDescription,
  },
  done: {
    title: copy.pin.setupSteps.successTitle,
    description: copy.pin.setupSteps.successDescription,
  },
};

const SETUP_BENEFITS = [...copy.pin.setupBenefits];

type PinSetupProgressProps = {
  step: SetupStep;
};

function PinSetupProgress({ step }: PinSetupProgressProps) {
  if (step === "done") return null;

  const currentIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className="mb-4">
      <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-muted/50 px-2 py-0.5 text-caption font-medium text-muted-foreground">
        Step {currentIndex + 1} of {STEPS.length}
      </span>
      <div className="mt-2 flex gap-1.5">
        {STEPS.map((item, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div
              key={item.id}
              className={cn(
                "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
                done && "bg-success",
                active && "bg-primary",
                !done && !active && "bg-border"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

type ZyndPinSetupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function ZyndPinSetupDialog({ open, onOpenChange, onCompleted }: ZyndPinSetupDialogProps) {
  const { refreshUser, user } = useAuth();
  const pinContext = useZyndPinOptional();
  const [step, setStep] = useState<SetupStep>("verify");
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

  const resetState = () => {
    setStep("verify");
    setCurrentPassword("");
    setTotpCode("");
    setPin("");
    setConfirmPin("");
    setError("");
    setLoading(false);
    setBiometricLoading(false);
    setBiometricEnabled(false);
  };

  useEffect(() => {
    if (!open) return;
    void isPlatformBiometricAvailable().then(setBiometricAvailable);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const handleVerifyContinue = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!currentPassword || totpCode.length !== appConfig.otpLength) return;
    setStep("pin");
  };

  const handlePinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pinsMismatch) {
      setError(copy.pin.pinMismatch);
      return;
    }
    if (!pinsMatch) return;

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

  const { title, description } = STEP_COPY[step];

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      icon={LockKeyhole}
      headerDensity="compact"
    >
      <div className="px-5 py-4">
          <PinSetupProgress step={step} />

          {step === "verify" ? (
            <form className="space-y-4" onSubmit={handleVerifyContinue}>
              <ul className="space-y-2">
                {SETUP_BENEFITS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-compact text-muted-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-4 shadow-zynd-low">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="size-3.5 text-muted-foreground" />
                      <Label htmlFor="zynd-pin-password" className="text-caption font-medium">
                        {copy.pin.setupStepPassword}
                      </Label>
                    </div>
                    <PasswordInput
                      id="zynd-pin-password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="mb-2 flex items-center gap-2">
                      <ShieldCheck className="size-3.5 text-muted-foreground" />
                      <p className="text-caption font-medium text-foreground">{copy.pin.setupStepMfa}</p>
                    </div>
                    <OtpInput value={totpCode} onChange={setTotpCode} />
                  </div>
                </div>
              </div>

              <FieldMessage message={error} />

              <AuthSubmitFooter hint={copy.pin.setupVerifyHint}>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!currentPassword || totpCode.length !== appConfig.otpLength}
                >
                  {copy.mfa.continue}
                </Button>
              </AuthSubmitFooter>
            </form>
          ) : null}

          {step === "pin" ? (
            <form className="space-y-4" onSubmit={handlePinSubmit}>
              <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-4 shadow-zynd-low">
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

              <AuthSubmitFooter className="space-y-2 pt-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !pinsMatch}
                >
                  {loading ? copy.mfa.verifying : copy.pin.setUpButton}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-full"
                  disabled={loading}
                  onClick={() => {
                    setStep("verify");
                    setError("");
                    setPin("");
                    setConfirmPin("");
                  }}
                >
                  Back
                </Button>
              </AuthSubmitFooter>
            </form>
          ) : null}

          {step === "done" ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-success/25 bg-success/5 px-4 py-5 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="size-6" strokeWidth={2.5} />
                </div>
                <p className="text-compact font-semibold text-foreground">
                  {copy.pin.setupSteps.successTitle}
                </p>
                <p className="mt-1 max-w-sm text-caption leading-relaxed text-muted-foreground">
                  {copy.pin.setupSteps.successDescription}
                </p>
              </div>

              {biometricAvailable && !biometricEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
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
                      setError(
                        err instanceof ApiError ? err.message : copy.pin.biometricCouldNotEnable
                      );
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
                <p className="text-center text-caption text-success">{copy.pin.biometricEnabledLabel}</p>
              ) : null}

              <AuthSubmitFooter>
                <Button className="w-full" onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}
        </div>
    </BrandDialog>
  );
}
