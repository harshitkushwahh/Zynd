"use client";

import { AlertTriangle, Check, Info } from "lucide-react";
import { useCallback, useState } from "react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { DeleteAccountHeroImage } from "@/components/dashboard/settings/delete-account-hero-image";
import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
import { StepUpSecondFactorFields } from "@/features/account/mfa/components/step-up-second-factor-fields";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type DeleteAccountStep = "intro" | "password" | "verify";

function getSteps(mfaEnabled: boolean): DeleteAccountStep[] {
  return mfaEnabled ? ["intro", "password", "verify"] : ["intro", "password"];
}

const INTRO_POINTS = [
  {
    icon: Check,
    tone: "primary" as const,
    text: copy.account.deletionGracePeriodShort(),
  },
  {
    icon: Info,
    tone: "info" as const,
    text: copy.account.deletionCancelDuringGrace,
  },
];

type DeleteAccountProgressProps = {
  step: DeleteAccountStep;
  mfaEnabled: boolean;
  compact?: boolean;
};

function DeleteAccountProgress({ step, mfaEnabled, compact = false }: DeleteAccountProgressProps) {
  const steps = getSteps(mfaEnabled);
  const currentIndex = steps.indexOf(step);

  return (
    <div className={cn("flex gap-1.5", compact ? "mb-1" : "mb-3")}>
      {steps.map((item, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div
            key={item}
            className={cn(
              "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
              done && "bg-success",
              active && "bg-destructive",
              !done && !active && "bg-border",
            )}
          />
        );
      })}
    </div>
  );
}

type DeleteAccountRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mfaEnabled: boolean;
  loading?: boolean;
  error?: string;
  onErrorChange?: (message: string) => void;
  onSubmit: (password: string, verification?: StepUpVerification) => void;
};

export function DeleteAccountRequestDialog({
  open,
  onOpenChange,
  mfaEnabled,
  loading = false,
  error = "",
  onErrorChange,
  onSubmit,
}: DeleteAccountRequestDialogProps) {
  const [step, setStep] = useState<DeleteAccountStep>("intro");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [smsOtp, setSmsOtp] = useState("");
  const [useSms, setUseSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const reset = useCallback(() => {
    setStep("intro");
    setPassword("");
    setTotp("");
    setSmsOtp("");
    setUseSms(false);
    setSmsSent(false);
    onErrorChange?.("");
  }, [onErrorChange]);

  useResetWhenDialogOpens(open, reset);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || loading) return;

    onErrorChange?.("");
    if (mfaEnabled) {
      setStep("verify");
      return;
    }

    onSubmit(password);
  };

  const handleVerifySubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const canSubmit = useSms ? smsOtp.length === 6 : totp.length === 6;
    if (!canSubmit || loading) return;
    onSubmit(password, useSms ? { smsOtp } : { totpCode: totp });
  };

  const canSubmitVerify = useSms ? smsOtp.length === 6 : totp.length === 6;

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.settings.confirmAccountDeletionTitle}
      maxWidth="lg"
    >
      <div className={cn("px-5 pb-5", step === "intro" ? "pt-4" : "pt-1.5")}>
        <DeleteAccountProgress step={step} mfaEnabled={mfaEnabled} compact={step !== "intro"} />

        {step === "intro" ? (
          <div className="space-y-5">
            <DeleteAccountHeroImage />

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

            <div className="rounded-[var(--radius-xl)] border border-destructive/20 bg-destructive/5 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {copy.settings.deletionStepFinalDescription()}
                </p>
              </div>
            </div>

            <AuthSubmitFooter className="pt-0">
              <Button type="button" className="w-full" onClick={() => setStep("password")}>
                {copy.mfa.continue}
              </Button>
            </AuthSubmitFooter>
          </div>
        ) : step === "password" ? (
          <form className="mt-2 space-y-4" onSubmit={handlePasswordSubmit}>
            <p className="text-caption leading-relaxed text-muted-foreground">
              {copy.account.deletionPasswordPrompt()}
            </p>

            <div className="space-y-2">
              <Label htmlFor="delete-account-password" className="text-caption font-medium">
                {copy.pin.setupStepPassword}
              </Label>
              <PasswordInput
                id="delete-account-password"
                placeholder={copy.settings.changePasswordCurrentPlaceholder}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) onErrorChange?.("");
                }}
                autoComplete="current-password"
                disabled={loading}
                autoFocus
              />
            </div>

            <FieldMessage message={error} />

            <AuthSubmitFooter className="pt-0">
              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={loading || !password}
              >
                {loading
                  ? "Requesting..."
                  : mfaEnabled
                    ? copy.mfa.continue
                    : copy.settings.requestDeletion}
              </Button>
            </AuthSubmitFooter>
          </form>
        ) : (
          <form className="mt-2 space-y-4" onSubmit={handleVerifySubmit}>
            <DeleteAccountHeroImage />

            <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
              <StepUpSecondFactorFields
                embedded
                centered
                useSms={useSms}
                onUseSmsChange={setUseSms}
                totpCode={totp}
                onTotpCodeChange={setTotp}
                smsOtp={smsOtp}
                onSmsOtpChange={setSmsOtp}
                smsSent={smsSent}
                onSmsSentChange={setSmsSent}
                disabled={loading}
                error={error}
                onErrorChange={onErrorChange}
              />
            </div>

            <AuthSubmitFooter className="pt-0">
              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={loading || !canSubmitVerify}
              >
                {loading ? "Requesting..." : copy.settings.requestDeletion}
              </Button>
            </AuthSubmitFooter>
          </form>
        )}
      </div>
    </BrandDialog>
  );
}
