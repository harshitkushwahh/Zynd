"use client";

import { Check, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import QRCode from "react-qr-code";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { mfaResetConfirm, mfaResetStart } from "@/lib/auth-api";
import { saveMfaBackupCodes } from "@/features/account/mfa/storage/mfa-backup-codes-storage";
import { copy } from "@/shared/config/copy";
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
    description: copy.auth.mfaAuthenticatorHint,
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

export function MfaResetDialog({ open, onOpenChange, onCompleted }: MfaResetDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<ResetStep>("verify");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTotp, setCurrentTotp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [newTotp, setNewTotp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const reset = () => {
    setStep("verify");
    setError("");
    setCurrentTotp("");
    setResetToken("");
    setQrUri("");
    setManualSecret("");
    setNewTotp("");
    setBackupCodes([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const verifyCurrentCode = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mfaResetStart(currentTotp);
      setResetToken(result.reset_token);
      setQrUri(result.qr_uri);
      setManualSecret(result.manual_secret);
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

  const currentIndex = STEPS.indexOf(step);
  const { title, description } = STEP_COPY[step];

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      icon={RefreshCw}
      maxWidth="lg"
    >
      <div className="p-6">
          <div className="mb-5">
            <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-muted/50 px-2.5 py-1 text-caption font-medium text-muted-foreground">
              Step {currentIndex + 1} of {STEPS.length}
            </span>
            <div className="mt-3 flex gap-1.5">
              {STEPS.map((item, index) => (
                <div
                  key={item}
                  className={cn(
                    "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
                    index < currentIndex && "bg-success",
                    index === currentIndex && "bg-primary",
                    index > currentIndex && "bg-border"
                  )}
                />
              ))}
            </div>
          </div>

          {step === "verify" ? (
            <div className="space-y-5">
              <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 p-5">
                <div className="mx-auto flex size-12 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" />
                </div>
                <p className="mt-4 text-center text-compact font-medium text-foreground">
                  Current authenticator code
                </p>
                <p className="mt-1 text-center text-caption text-muted-foreground">
                  {copy.auth.mfaAuthenticatorForApp}
                </p>
                <input
                  id="mfa-reset-current"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={currentTotp}
                  onChange={(event) =>
                    setCurrentTotp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  className="auth-input-underline mt-5 w-full text-center tracking-[0.35em] text-body font-medium"
                />
              </div>
              <FieldMessage message={error} />
              <AuthSubmitFooter>
                <Button
                  className="w-full"
                  onClick={verifyCurrentCode}
                  disabled={loading || currentTotp.length !== 6}
                >
                  {loading ? copy.mfa.verifying : copy.mfa.continue}
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}

          {step === "confirm" ? (
            <div className="space-y-5">
              <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-4">
                {qrUri ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-[var(--radius-control)] border border-border bg-white p-3">
                      <QRCode value={qrUri} size={168} />
                    </div>
                    <p className="text-center text-caption text-muted-foreground">
                      Scan with your authenticator app
                    </p>
                  </div>
                ) : null}

                <div className="relative my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-caption text-muted-foreground">{copy.mfa.orEnterManually}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="mx-auto w-full max-w-sm rounded-[var(--radius-control)] border border-border bg-background p-3 text-center">
                  <div className="mb-2 flex items-center justify-center gap-2 text-caption font-medium text-muted-foreground">
                    <KeyRound className="size-3.5" />
                    Setup key
                  </div>
                  <p className="break-all font-mono text-compact leading-relaxed">{manualSecret}</p>
                </div>
              </div>

              <div>
                <label htmlFor="mfa-reset-new" className="mb-2 block text-caption font-medium text-foreground">
                  New authenticator code
                </label>
                <input
                  id="mfa-reset-new"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={newTotp}
                  onChange={(event) =>
                    setNewTotp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  className="auth-input-underline w-full text-center tracking-[0.35em] text-body font-medium"
                />
              </div>

              <FieldMessage message={error} />
              <AuthSubmitFooter>
                <Button
                  className="w-full"
                  onClick={confirmNewAuthenticator}
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
            <div className="space-y-5">
              <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-success/20 bg-success/5 px-3 py-2.5 text-compact text-success">
                <Check className="size-4 shrink-0" />
                Your authenticator has been updated successfully.
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-compact">
                {backupCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded-[var(--radius-control)] border border-border bg-background px-2.5 py-2 text-center"
                  >
                    {code}
                  </span>
                ))}
              </div>

              <AuthSubmitFooter hint={copy.mfa.backupCodesOfflineHint}>
                <Button className="w-full" onClick={handleDone}>
                  Done
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}
        </div>
    </BrandDialog>
  );
}
