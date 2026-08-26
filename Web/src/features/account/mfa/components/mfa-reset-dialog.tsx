"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

import { AuthSubmitFooter, OtpInput } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { MfaBrandedQrImage } from "@/features/account/mfa/components/mfa-branded-qr-image";
import { MfaResetHeroImage } from "@/features/account/mfa/components/mfa-reset-hero-image";
import { ApiError } from "@/lib/api-client";
import { mfaResetConfirm, mfaResetStart } from "@/lib/auth-api";
import { saveMfaBackupCodes } from "@/features/account/mfa/storage/mfa-backup-codes-storage";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { cn } from "@/lib/utils";

type MfaResetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

type ResetStep = "verify" | "confirm" | "backup";

const STEPS: ResetStep[] = ["verify", "confirm", "backup"];

const STEP_COPY: Record<ResetStep, { title: string; description: string }> = {
  verify: {
    title: copy.mfa.reset.verifyTitle,
    description: copy.auth.mfaAuthenticatorForApp,
  },
  confirm: {
    title: copy.mfa.reset.confirmTitle,
    description: copy.mfa.reset.confirmDescription,
  },
  backup: {
    title: copy.mfa.reset.backupTitle,
    description: copy.mfa.reset.backupDescription,
  },
};

type MfaResetProgressProps = {
  step: ResetStep;
  compact?: boolean;
};

function MfaResetProgress({ step, compact = false }: MfaResetProgressProps) {
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

export function MfaResetDialog({ open, onOpenChange, onCompleted }: MfaResetDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<ResetStep>("verify");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTotp, setCurrentTotp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [qrPngSrc, setQrPngSrc] = useState<string | null>(null);
  const [newTotp, setNewTotp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const reset = useCallback(() => {
    setStep("verify");
    setError("");
    setCurrentTotp("");
    setResetToken("");
    setManualSecret("");
    setQrPngSrc(null);
    setNewTotp("");
    setBackupCodes([]);
  }, []);

  useResetWhenDialogOpens(open, reset);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const verifyCurrentCode = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mfaResetStart(currentTotp);
      setResetToken(result.reset_token);
      setManualSecret(result.manual_secret);
      setQrPngSrc(
        result.qr_png_base64 ? `data:image/png;base64,${result.qr_png_base64}` : null,
      );
      setStep("confirm");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.reset.couldNotVerify);
    } finally {
      setLoading(false);
    }
  };

  const confirmNewAuthenticator = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mfaResetConfirm(resetToken, newTotp);
      setBackupCodes(result.backup_codes);
      if (user?.id) {
        saveMfaBackupCodes(user.id, result.backup_codes);
      }
      setStep("backup");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.reset.invalidCode);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    onCompleted?.();
    handleOpenChange(false);
  };

  const { title } = STEP_COPY[step];

  return (
    <BrandDialog open={open} onOpenChange={handleOpenChange} title={title} maxWidth="lg">
      <div className={cn("px-5 pb-5", step === "verify" ? "pt-4" : "pt-1.5")}>
        <MfaResetProgress step={step} compact={step !== "verify"} />

        {step === "verify" ? (
          <div className="space-y-4">
            <MfaResetHeroImage />

            <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
              <div className="space-y-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="size-4 text-primary" strokeWidth={2.25} aria-hidden />
                  <Label htmlFor="mfa-reset-current" className="text-caption font-medium">
                    {copy.pin.setupStepMfa}
                  </Label>
                </div>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {copy.auth.mfaAuthenticatorForApp}
                </p>
                <OtpInput
                  id="mfa-reset-current"
                  value={currentTotp}
                  error={!!error}
                  onChange={(value) => {
                    setCurrentTotp(value);
                    if (error) setError("");
                  }}
                />
              </div>
            </div>

            <FieldMessage message={error} className="text-center" />

            <AuthSubmitFooter className="pt-0">
              <Button
                type="button"
                className="w-full"
                onClick={() => void verifyCurrentCode()}
                disabled={loading || currentTotp.length !== 6}
              >
                {loading ? copy.mfa.verifying : copy.mfa.continue}
              </Button>
            </AuthSubmitFooter>
          </div>
        ) : null}

        {step === "confirm" ? (
          <div className="mt-2 space-y-4">
            {resetToken ? (
              <MfaBrandedQrImage
                kind="reset"
                token={resetToken}
                initialSrc={qrPngSrc}
                alt={copy.mfa.reset.confirmTitle}
              />
            ) : null}

            <div className="relative flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-caption text-muted-foreground">{copy.mfa.orEnterManually}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="mx-auto w-full max-w-sm rounded-[var(--radius-xl)] border border-border bg-muted/20 p-3 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-caption font-medium text-muted-foreground">
                <KeyRound className="size-3.5" />
                Setup key
              </div>
              <p className="break-all font-mono text-compact leading-relaxed">{manualSecret}</p>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="mfa-reset-new" className="text-caption font-medium">
                    New authenticator code
                  </Label>
                  <p className="text-caption leading-relaxed text-muted-foreground">
                    {copy.mfa.reset.confirmDescription}
                  </p>
                </div>
                <OtpInput
                  id="mfa-reset-new"
                  value={newTotp}
                  error={!!error}
                  onChange={(value) => {
                    setNewTotp(value);
                    if (error) setError("");
                  }}
                />
              </div>
            </div>

            <FieldMessage message={error} />

            <AuthSubmitFooter className="pt-0">
              <Button
                type="button"
                className="w-full"
                onClick={() => void confirmNewAuthenticator()}
                disabled={loading || newTotp.length !== 6}
              >
                {loading ? copy.mfa.verifying : copy.mfa.reset.confirmNewAuthenticator}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={loading}
                onClick={() => {
                  setStep("verify");
                  setError("");
                  setNewTotp("");
                }}
              >
                Back
              </Button>
            </AuthSubmitFooter>
          </div>
        ) : null}

        {step === "backup" ? (
          <div className="mt-2 space-y-4">
            <UiMessage
              variant="success"
              message="Your authenticator has been updated successfully."
              className="mt-0"
            />

            <div className="grid grid-cols-2 gap-2 font-mono text-compact sm:grid-cols-3">
              {backupCodes.map((code) => (
                <span
                  key={code}
                  className="rounded-[var(--radius-control)] border border-border bg-muted/20 px-2.5 py-2 text-center"
                >
                  {code}
                </span>
              ))}
            </div>

            <AuthSubmitFooter hint={copy.mfa.backupCodesOfflineHint} className="pt-0">
              <Button type="button" className="w-full" onClick={handleDone}>
                Done
              </Button>
            </AuthSubmitFooter>
          </div>
        ) : null}
      </div>
    </BrandDialog>
  );
}
