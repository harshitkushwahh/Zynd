"use client";

import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

import { DistributorBackupCodesPanel } from "@/components/auth/distributor-backup-codes-panel";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { mfaResetConfirm, mfaResetStart } from "@/lib/distributor-account-api";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type DistributorMfaResetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

type ResetStep = "verify" | "confirm" | "backup";

const STEPS: ResetStep[] = ["verify", "confirm", "backup"];

const STEP_COPY: Record<ResetStep, { title: string; description: string }> = {
  verify: {
    title: "Verify current authenticator",
    description: "Enter the 6-digit code from your current authenticator app.",
  },
  confirm: {
    title: "Set up new authenticator",
    description: "Scan the QR code or enter the setup key, then confirm with a new code.",
  },
  backup: {
    title: "Save new backup codes",
    description: "Store these codes somewhere safe before continuing.",
  },
};

export function DistributorMfaResetDialog({
  open,
  onOpenChange,
  onCompleted,
}: DistributorMfaResetDialogProps) {
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

  useEffect(() => {
    if (!open) reset();
  }, [open]);

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
      setError(err instanceof ApiError ? err.message : "Could not verify your authenticator code.");
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
      setStep("backup");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid authenticator code.");
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <div className="border-b border-border px-6 py-5">
          <div className="mb-3 flex size-10 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
            <RefreshCw className="size-5" />
          </div>
          <DialogTitle className="text-compact font-semibold text-foreground">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-caption text-muted-foreground">
            {description}
          </DialogDescription>
          <div className="mt-4">
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
                    index > currentIndex && "bg-border",
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {step === "verify" ? (
            <>
              <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 p-5">
                <div className="mx-auto flex size-12 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" />
                </div>
                <p className="mt-4 text-center text-compact font-medium text-foreground">
                  Current authenticator code
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
              {error ? <DistributorFeedbackMessage variant="error">{error}</DistributorFeedbackMessage> : null}
              <DistributorActionButton
                type="button"
                variant="primary"
                className="w-full"
                disabled={loading || currentTotp.length !== 6}
                onClick={() => void verifyCurrentCode()}
              >
                {loading ? "Verifying…" : "Continue"}
              </DistributorActionButton>
            </>
          ) : null}

          {step === "confirm" ? (
            <>
              <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-4">
                {qrUri ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-[var(--radius-control)] border border-border bg-card p-3 shadow-zynd-low">
                      <QRCode value={qrUri} size={168} />
                    </div>
                    <p className="text-center text-caption text-muted-foreground">
                      Scan with your authenticator app
                    </p>
                  </div>
                ) : null}

                <div className="relative my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-caption text-muted-foreground">or enter manually</span>
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

              <div className="space-y-2">
                <Label htmlFor="mfa-reset-new">New authenticator code</Label>
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

              {error ? <DistributorFeedbackMessage variant="error">{error}</DistributorFeedbackMessage> : null}
              <div className="flex flex-col gap-2">
                <DistributorActionButton
                  type="button"
                  variant="primary"
                  className="w-full"
                  disabled={loading || newTotp.length !== 6}
                  onClick={() => void confirmNewAuthenticator()}
                >
                  {loading ? "Verifying…" : "Confirm new authenticator"}
                </DistributorActionButton>
                <DistributorActionButton
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={() => {
                    setStep("verify");
                    setError("");
                    setNewTotp("");
                  }}
                >
                  Back
                </DistributorActionButton>
              </div>
            </>
          ) : null}

          {step === "backup" ? (
            <>
              <DistributorFeedbackMessage variant="success">
                Your authenticator has been updated successfully.
              </DistributorFeedbackMessage>
              <DistributorBackupCodesPanel codes={backupCodes} />
              <DistributorActionButton type="button" variant="primary" className="w-full" onClick={handleDone}>
                Done
              </DistributorActionButton>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
