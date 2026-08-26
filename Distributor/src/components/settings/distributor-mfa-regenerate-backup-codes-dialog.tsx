"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { OtpInput } from "@/components/auth/otp-input";
import { DistributorBackupCodesPanel } from "@/components/auth/distributor-backup-codes-panel";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { regenerateMfaBackupCodes } from "@/lib/distributor-account-api";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type DistributorMfaRegenerateBackupCodesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

function isValidPassword(password: string) {
  return password.length >= 8;
}

export function DistributorMfaRegenerateBackupCodesDialog({
  open,
  onOpenChange,
  onUpdated,
}: DistributorMfaRegenerateBackupCodesDialogProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [regenPassword, setRegenPassword] = useState("");
  const [regenOtp, setRegenOtp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const resetForm = () => {
    setError("");
    setMessage("");
    setRegenPassword("");
    setRegenOtp("");
    setBackupCodes([]);
    setActionLoading(false);
  };

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  const handleRegenerateBackup = async () => {
    if (!isValidPassword(regenPassword)) {
      setError("Enter your current password.");
      return;
    }
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await regenerateMfaBackupCodes({
        currentPassword: regenPassword,
        totpCode: regenOtp || undefined,
      });
      setBackupCodes(result.backup_codes);
      setRegenPassword("");
      setRegenOtp("");
      setMessage("New backup codes generated.");
      onUpdated?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not regenerate backup codes.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="border-b border-border px-6 py-5">
          <div className="mb-3 flex size-10 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
            <RefreshCw className="size-5" />
          </div>
          <DialogTitle className="text-compact font-semibold text-foreground">
            Regenerate backup codes
          </DialogTitle>
          <DialogDescription className="mt-2 text-caption text-muted-foreground">
            Generate a fresh set of one-time backup codes. Previous codes will stop working.
          </DialogDescription>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error ? (
            <DistributorFeedbackMessage variant="error" onDismiss={() => setError("")}>
              {error}
            </DistributorFeedbackMessage>
          ) : null}
          {message ? (
            <DistributorFeedbackMessage variant="success" onDismiss={() => setMessage("")}>
              {message}
            </DistributorFeedbackMessage>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="mfa-regen-password">Current password</Label>
            <Input
              id="mfa-regen-password"
              type="password"
              autoComplete="current-password"
              value={regenPassword}
              onChange={(event) => setRegenPassword(event.target.value)}
              placeholder="Current password"
              className="auth-input-underline"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-caption text-muted-foreground">Authenticator code</Label>
            <OtpInput value={regenOtp} onChange={setRegenOtp} />
          </div>

          <DistributorActionButton
            type="button"
            variant="primary"
            className="w-full"
            disabled={actionLoading}
            onClick={() => void handleRegenerateBackup()}
          >
            <RefreshCw className={cn("size-3.5", actionLoading && "animate-spin")} />
            {actionLoading ? "Regenerating…" : "Regenerate codes"}
          </DistributorActionButton>

          {backupCodes.length ? <DistributorBackupCodesPanel codes={backupCodes} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
