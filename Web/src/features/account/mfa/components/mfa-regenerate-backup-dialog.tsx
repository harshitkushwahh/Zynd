"use client";

import { Check, Info } from "lucide-react";
import { useCallback, useState } from "react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MfaRegenerateBackupHeroImage } from "@/features/account/mfa/components/mfa-regenerate-backup-hero-image";
import { StepUpSecondFactorFields } from "@/features/account/mfa/components/step-up-second-factor-fields";
import { saveMfaBackupCodes } from "@/features/account/mfa/storage/mfa-backup-codes-storage";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { regenerateMfaBackupCodes } from "@/lib/auth-api";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { cn } from "@/lib/utils";

type RegenerateStep = "intro" | "verify";

const STEPS: { id: RegenerateStep; label: string }[] = [
  { id: "intro", label: "Overview" },
  { id: "verify", label: "Verify identity" },
];

const STEP_COPY: Record<RegenerateStep, { title: string; description: string }> = {
  intro: {
    title: copy.mfa.regenerate.title,
    description: copy.settings.backupCodesDescription,
  },
  verify: {
    title: copy.pin.setupSteps.verifyTitle,
    description: copy.pin.setupSteps.verifyDescription,
  },
};

const INTRO_POINTS = [
  {
    icon: Check,
    tone: "primary" as const,
    text: copy.settings.backupCodesDescription,
  },
  {
    icon: Info,
    tone: "info" as const,
    text: copy.mfa.reset.backupDescription,
  },
];

type RegenerateProgressProps = {
  step: RegenerateStep;
  compact?: boolean;
};

function RegenerateProgress({ step, compact = false }: RegenerateProgressProps) {
  const currentIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className={cn("flex gap-1.5", compact ? "mb-1" : "mb-3")}>
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
                !done && !active && "bg-border",
              )}
            />
          );
        })}
    </div>
  );
}

type MfaRegenerateBackupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function MfaRegenerateBackupDialog({
  open,
  onOpenChange,
  onCompleted,
}: MfaRegenerateBackupDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<RegenerateStep>("intro");
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
    if (!user) return;

    setLoading(true);
    setError("");
    try {
      const result = await regenerateMfaBackupCodes({
        currentPassword: password,
        totpCode: useSms ? undefined : totp || undefined,
        smsOtp: useSms ? smsOtp : undefined,
      });
      saveMfaBackupCodes(user.id, result.backup_codes);
      onCompleted?.();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.regenerate.couldNotRegenerate);
    } finally {
      setLoading(false);
    }
  };

  const { title } = STEP_COPY[step];

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      maxWidth="lg"
    >
      <div className={cn("px-5 pb-5", step === "intro" ? "pt-4" : "pt-1.5")}>
        <RegenerateProgress step={step} compact={step !== "intro"} />

        {step === "intro" ? (
          <div className="space-y-5">
            <MfaRegenerateBackupHeroImage />

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

            <AuthSubmitFooter>
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
                  <Label htmlFor="regenerate-password" className="text-caption font-medium">
                    {copy.pin.setupStepPassword}
                  </Label>
                  <PasswordInput
                    id="regenerate-password"
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
              <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
                {loading ? copy.mfa.regenerate.regenerating : copy.mfa.regenerate.submit}
              </Button>
            </AuthSubmitFooter>
          </form>
        )}
      </div>
    </BrandDialog>
  );
}
