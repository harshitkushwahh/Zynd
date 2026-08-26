"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useCallback, useState } from "react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MfaDisableHeroImage } from "@/features/account/mfa/components/mfa-disable-hero-image";
import { StepUpSecondFactorFields } from "@/features/account/mfa/components/step-up-second-factor-fields";
import { clearMfaBackupCodes } from "@/features/account/mfa/storage/mfa-backup-codes-storage";
import { ApiError } from "@/lib/api-client";
import { mfaDisable } from "@/lib/auth-api";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { cn } from "@/lib/utils";

type DisableStep = "intro" | "verify";

const STEPS: DisableStep[] = ["intro", "verify"];

const STEP_COPY: Record<DisableStep, { title: string }> = {
  intro: { title: copy.mfa.disable.title },
  verify: { title: copy.pin.setupSteps.verifyTitle },
};

const INTRO_POINTS = [
  {
    icon: Check,
    tone: "primary" as const,
    text: "Authenticator app protection will be removed from your account.",
  },
  {
    icon: AlertTriangle,
    tone: "info" as const,
    text: "Other active sessions will be signed out.",
  },
];

type DisableProgressProps = {
  step: DisableStep;
  compact?: boolean;
};

function DisableProgress({ step, compact = false }: DisableProgressProps) {
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

type MfaDisableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCompleted?: () => void;
};

export function MfaDisableDialog({
  open,
  onOpenChange,
  userId,
  onCompleted,
}: MfaDisableDialogProps) {
  const [step, setStep] = useState<DisableStep>("intro");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [smsOtp, setSmsOtp] = useState("");
  const [useSms, setUseSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setStep("intro");
    setPassword("");
    setTotp("");
    setSmsOtp("");
    setUseSms(false);
    setSmsSent(false);
    setError("");
  }, []);

  useResetWhenDialogOpens(open, reset);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const canSubmit = password.length > 0 && (useSms ? smsOtp.length === 6 : totp.length === 6);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);
    setError("");
    try {
      await mfaDisable({
        currentPassword: password,
        totpCode: useSms ? undefined : totp || undefined,
        smsOtp: useSms ? smsOtp : undefined,
      });
      clearMfaBackupCodes(userId);
      onCompleted?.();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.disable.couldNotDisable);
    } finally {
      setLoading(false);
    }
  };

  const { title } = STEP_COPY[step];

  return (
    <BrandDialog open={open} onOpenChange={handleOpenChange} title={title} maxWidth="lg">
      <div className={cn("px-5 pb-5", step === "intro" ? "pt-4" : "pt-1.5")}>
        <DisableProgress step={step} compact={step !== "intro"} />

        {step === "intro" ? (
          <div className="space-y-5">
            <MfaDisableHeroImage />

            <ul className="space-y-2.5">
              {INTRO_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.text} className="flex items-start gap-2.5 text-compact text-muted-foreground">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        point.tone === "primary" && "bg-primary/10 text-primary",
                        point.tone === "info" && "bg-warning/10 text-warning",
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
              <Button type="button" className="w-full" onClick={() => setStep("verify")}>
                {copy.mfa.continue}
              </Button>
            </AuthSubmitFooter>
          </div>
        ) : (
          <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="disable-mfa-password" className="text-caption font-medium">
                    {copy.pin.setupStepPassword}
                  </Label>
                  <PasswordInput
                    id="disable-mfa-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>

                <div className="border-t border-border pt-4">
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
                    onErrorChange={setError}
                  />
                </div>
              </div>
            </div>

            <AuthSubmitFooter className="pt-0">
              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={loading || !canSubmit}
              >
                {loading ? copy.mfa.disable.disabling : copy.mfa.disable.submit}
              </Button>
            </AuthSubmitFooter>
          </form>
        )}
      </div>
    </BrandDialog>
  );
}
