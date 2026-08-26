"use client";

import { Check, Info } from "lucide-react";
import { useCallback, useState } from "react";

import { PinInput } from "@/features/account/pin/components/pin-input";
import { verifyZyndPin } from "@/features/account/pin/api/pin-api";
import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MfaRevealBackupHeroImage } from "@/features/account/mfa/components/mfa-reveal-backup-hero-image";
import { FieldMessage } from "@/components/ui/ui-message";
import { verifyAccountPassword } from "@/features/account/api/account-api";
import { ApiError } from "@/lib/api-client";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { cn } from "@/lib/utils";

type AccessStep = "intro" | "verify";
type VerifyMethod = "pin" | "password";

const STEPS: AccessStep[] = ["intro", "verify"];

const INTRO_POINTS = [
  {
    icon: Check,
    tone: "primary" as const,
    text: copy.mfa.backupAccess.hiddenHint,
  },
  {
    icon: Info,
    tone: "info" as const,
    text: copy.mfa.backupCodesOfflineHint,
  },
];

type RevealBackupProgressProps = {
  step: AccessStep;
  compact?: boolean;
};

function RevealBackupProgress({ step, compact = false }: RevealBackupProgressProps) {
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

type MfaBackupCodesAccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinEnrolled: boolean;
  onVerified: () => void;
};

export function MfaBackupCodesAccessDialog({
  open,
  onOpenChange,
  pinEnrolled,
  onVerified,
}: MfaBackupCodesAccessDialogProps) {
  const [step, setStep] = useState<AccessStep>("intro");
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>(pinEnrolled ? "pin" : "password");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setStep("intro");
    setVerifyMethod(pinEnrolled ? "pin" : "password");
    setPin("");
    setPassword("");
    setError("");
    setLoading(false);
  }, [pinEnrolled]);

  useResetWhenDialogOpens(open, reset);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const completeVerification = () => {
    onVerified();
    handleOpenChange(false);
  };

  const handlePinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pin.length !== appConfig.pinLength || loading) return;

    setLoading(true);
    setError("");
    try {
      await verifyZyndPin(pin);
      completeVerification();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.backupAccess.invalidPin);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError("");
    try {
      await verifyAccountPassword(password);
      completeVerification();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.backupAccess.invalidPassword);
    } finally {
      setLoading(false);
    }
  };

  const dialogTitle =
    step === "intro"
      ? copy.mfa.backupAccess.reveal
      : verifyMethod === "pin"
        ? copy.mfa.backupAccess.pinTitle
        : copy.mfa.backupAccess.passwordTitle;

  return (
    <BrandDialog open={open} onOpenChange={handleOpenChange} title={dialogTitle} maxWidth="lg">
      <div className={cn("px-5 pb-5", step === "intro" ? "pt-4" : "pt-1.5")}>
        <RevealBackupProgress step={step} compact={step !== "intro"} />

        {step === "intro" ? (
          <div className="space-y-5">
            <MfaRevealBackupHeroImage />

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

            <AuthSubmitFooter className="pt-0">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setVerifyMethod(pinEnrolled ? "pin" : "password");
                  setStep("verify");
                }}
              >
                {copy.mfa.continue}
              </Button>
            </AuthSubmitFooter>
          </div>
        ) : verifyMethod === "pin" ? (
          <form className="mt-2 space-y-4" onSubmit={handlePinSubmit}>
            <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
              <div className="space-y-3 text-center">
                <p className="text-caption font-medium text-foreground">
                  {copy.mfa.backupAccess.pinTitle}
                </p>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {copy.mfa.backupAccess.pinDescription}
                </p>
                <PinInput value={pin} onChange={setPin} autoFocus error={Boolean(error)} />
              </div>
            </div>

            <FieldMessage message={error} className="text-center" />

            <AuthSubmitFooter className="space-y-2 pt-0">
              <Button
                type="submit"
                className="w-full"
                disabled={loading || pin.length !== appConfig.pinLength}
              >
                {loading ? copy.mfa.verifying : copy.mfa.backupAccess.reveal}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-full"
                disabled={loading}
                onClick={() => {
                  setError("");
                  setPin("");
                  setVerifyMethod("password");
                }}
              >
                {copy.mfa.backupAccess.usePasswordInstead}
              </Button>
            </AuthSubmitFooter>
          </form>
        ) : (
          <form className="mt-2 space-y-4" onSubmit={handlePasswordSubmit}>
            <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
              <div className="space-y-2">
                <Label htmlFor="reveal-backup-password" className="text-caption font-medium">
                  {copy.pin.setupStepPassword}
                </Label>
                <PasswordInput
                  id="reveal-backup-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  autoFocus
                />
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {copy.mfa.backupAccess.passwordDescription}
                </p>
              </div>
            </div>

            <FieldMessage message={error} />

            <AuthSubmitFooter className="space-y-2 pt-0">
              <Button type="submit" className="w-full" disabled={loading || !password}>
                {loading ? copy.mfa.verifying : copy.mfa.backupAccess.reveal}
              </Button>
              {pinEnrolled ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-full"
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setPassword("");
                    setVerifyMethod("pin");
                  }}
                >
                  {copy.pin.biometricUsePin}
                </Button>
              ) : null}
            </AuthSubmitFooter>
          </form>
        )}
      </div>
    </BrandDialog>
  );
}
