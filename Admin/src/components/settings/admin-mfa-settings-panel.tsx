"use client";

import { Check, Copy, KeyRound, RefreshCw, Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { getErrorMessage } from "@/lib/errors";

import { OtpInput } from "@/components/auth/otp-input";
import { PasswordInput } from "@/components/auth/password-input";
import { AdminZyndPinSettingsSection } from "@/components/settings/admin-zynd-pin-settings-section";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  ADMIN_STATUS_SUCCESS_PANEL,
} from "@/components/ui/admin-design-tokens";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  fetchMfaBackupCodesStatus,
  mfaDisable,
  mfaEnrollConfirm,
  mfaEnrollStart,
  regenerateMfaBackupCodes,
} from "@/lib/admin-account-api";
import { isValidOtp, isValidPassword } from "@/lib/admin-validation";
import { cn } from "@/lib/utils";

const MFA_SETUP_POINTS = [
  "Use Google Authenticator, Authy, or any TOTP app",
  "Required for sensitive admin actions and PIN lock setup",
  "Backup codes help you sign in if you lose your phone",
] as const;


export function AdminMfaSettingsPanel() {
  const { user, refreshUser } = useAdminAuth();
  const [backupStatus, setBackupStatus] = useState({
    enrolled: false,
    total: 0,
    remaining: 0,
    used: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [enrollToken, setEnrollToken] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [enrollOtp, setEnrollOtp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [disablePassword, setDisablePassword] = useState("");
  const [disableOtp, setDisableOtp] = useState("");
  const [regenPassword, setRegenPassword] = useState("");
  const [regenOtp, setRegenOtp] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setBackupStatus(await fetchMfaBackupCodesStatus());
    } catch {
      setBackupStatus({ enrolled: false, total: 0, remaining: 0, used: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, user?.mfa_enrolled]);

  if (!user) return null;

  const mfaEnabled = user.mfa_enrolled;

  const handleStartEnroll = async () => {
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await mfaEnrollStart();
      setEnrollToken(result.enroll_token);
      setManualSecret(result.manual_secret);
      setQrUri(result.qr_uri);
      setEnrollOtp("");
      setCopiedSecret(false);
      setMessage("Scan the QR code in your authenticator app, then enter the verification code.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not start MFA enrollment."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEnroll = () => {
    setEnrollToken("");
    setManualSecret("");
    setQrUri("");
    setEnrollOtp("");
    setCopiedSecret(false);
    setError("");
    setMessage("");
  };

  const handleCopySecret = async () => {
    if (!manualSecret) return;
    await navigator.clipboard.writeText(manualSecret);
    setCopiedSecret(true);
    setMessage("Setup key copied to clipboard.");
    window.setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleConfirmEnroll = async () => {
    if (!isValidOtp(enrollOtp)) {
      setError("Enter a valid authenticator code.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const result = await mfaEnrollConfirm(enrollToken, enrollOtp);
      setBackupCodes(result.backup_codes);
      handleCancelEnroll();
      setMessage("MFA enabled. Save your backup codes in a secure place.");
      await refreshUser();
      await loadStatus();
    } catch (err) {
      setError(getErrorMessage(err, "Could not confirm MFA enrollment."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!isValidPassword(disablePassword)) {
      setError("Enter your current password.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await mfaDisable({
        currentPassword: disablePassword,
        totpCode: disableOtp || undefined,
      });
      setDisablePassword("");
      setDisableOtp("");
      setMessage("MFA disabled.");
      await refreshUser();
      await loadStatus();
    } catch (err) {
      setError(getErrorMessage(err, "Could not disable MFA."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateBackup = async () => {
    if (!isValidPassword(regenPassword)) {
      setError("Enter your current password.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const result = await regenerateMfaBackupCodes({
        currentPassword: regenPassword,
        totpCode: regenOtp || undefined,
      });
      setBackupCodes(result.backup_codes);
      setRegenPassword("");
      setRegenOtp("");
      setMessage("New backup codes generated.");
      await loadStatus();
    } catch (err) {
      setError(getErrorMessage(err, "Could not regenerate backup codes."));
    } finally {
      setActionLoading(false);
    }
  };

  const copyBackupCodes = async () => {
    if (!backupCodes.length) return;
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setMessage("Backup codes copied to clipboard.");
  };

  return (
    <div className="space-y-6">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

      <div className="space-y-4 rounded-[var(--radius-card)] border border-border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div className="space-y-2">
              <p className="text-compact font-semibold text-foreground">Authenticator app</p>
              <p className="text-caption text-muted-foreground">
                {mfaEnabled
                  ? "Your admin account is protected with time-based verification codes."
                  : "Protect your admin account with an authenticator app."}
              </p>
              {mfaEnabled && !loading ? (
                <p className="text-caption text-muted-foreground">
                  {backupStatus.remaining} of {backupStatus.total} backup codes remaining
                </p>
              ) : null}
            </div>
          </div>

          {!mfaEnabled && !enrollToken ? (
            <Button
              size="sm"
              className="shrink-0"
              disabled={actionLoading}
              onClick={() => void handleStartEnroll()}
            >
              <ShieldCheck className="size-3.5" />
              {actionLoading ? "Starting…" : "Set up MFA"}
            </Button>
          ) : null}
        </div>

        {!mfaEnabled && !enrollToken ? (
          <ul className="space-y-2 border-t border-border pt-4">
            {MFA_SETUP_POINTS.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 text-caption text-muted-foreground"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3" strokeWidth={2.5} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        ) : null}

        {!mfaEnabled && enrollToken ? (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-muted/50 px-2 py-0.5 text-caption font-medium text-muted-foreground">
                Step 2 of 2 · Verify setup
              </span>
              <Button variant="ghost" size="sm" disabled={actionLoading} onClick={handleCancelEnroll}>
                Cancel
              </Button>
            </div>

            <div className="rounded-[var(--radius-card)] border border-border bg-muted/20 p-4">
              {qrUri ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-[var(--radius-control)] border border-border bg-white p-3 shadow-zynd-low">
                    <QRCode value={qrUri} size={140} bgColor="#FFFFFF" fgColor="#000000" />
                  </div>
                  <p className="text-center text-caption text-muted-foreground">
                    Scan with your authenticator app
                  </p>
                </div>
              ) : null}

              <div className="relative my-4 flex items-center justify-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="shrink-0 text-caption text-muted-foreground">or enter manually</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="rounded-[var(--radius-control)] border border-border bg-background px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label className="text-caption">Setup key</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Copy setup key"
                    onClick={() => void handleCopySecret()}
                  >
                    {copiedSecret ? (
                      <Check className="size-3.5 text-success" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
                <p className="break-all font-mono text-caption leading-relaxed text-foreground">
                  {manualSecret}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Verification code</Label>
              <OtpInput value={enrollOtp} onChange={setEnrollOtp} />
              <p className="text-caption text-muted-foreground">
                Enter the 6-digit code from your authenticator app to finish setup.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" disabled={actionLoading} onClick={handleCancelEnroll}>
                Back
              </Button>
              <Button
                disabled={actionLoading || !isValidOtp(enrollOtp)}
                onClick={() => void handleConfirmEnroll()}
              >
                {actionLoading ? "Confirming…" : "Enable MFA"}
              </Button>
            </div>
          </div>
        ) : null}

        {mfaEnabled ? (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-muted/10 p-4">
              <p className="text-compact font-medium text-foreground">Regenerate backup codes</p>
              <p className="text-caption text-muted-foreground">
                Generate a fresh set of one-time backup codes. Previous codes will stop working.
              </p>
              <PasswordInput
                value={regenPassword}
                onChange={(event) => setRegenPassword(event.target.value)}
                placeholder="Current password"
              />
              <OtpInput value={regenOtp} onChange={setRegenOtp} />
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={() => void handleRegenerateBackup()}
              >
                <RefreshCw className={cn("size-3.5", actionLoading && "animate-spin")} />
                Regenerate codes
              </Button>
            </div>

            <div className="space-y-3 rounded-[var(--radius-card)] border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-compact font-medium text-foreground">Disable MFA</p>
              <p className="text-caption text-muted-foreground">
                Removes authenticator protection from your admin account.
              </p>
              <PasswordInput
                icon={KeyRound}
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
                placeholder="Current password"
              />
              <OtpInput value={disableOtp} onChange={setDisableOtp} />
              <Button
                variant="destructive"
                size="sm"
                disabled={actionLoading}
                onClick={() => void handleDisable()}
              >
                <ShieldOff className="size-3.5" />
                Disable MFA
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {backupCodes.length ? (
        <div className={cn("space-y-3 rounded-[var(--radius-card)] p-4", ADMIN_STATUS_SUCCESS_PANEL)}>
          <div>
            <p className="text-compact font-semibold text-foreground">Save your backup codes</p>
            <p className="mt-1 text-caption text-muted-foreground">
              Store these codes somewhere safe. Each code works once if you lose access to your
              authenticator app.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-[var(--radius-control)] border border-border bg-background p-3 font-mono text-caption">
            {backupCodes.join("\n")}
          </pre>
          <Button variant="outline" size="sm" onClick={() => void copyBackupCodes()}>
            <Copy className="size-3.5" />
            Copy codes
          </Button>
        </div>
      ) : null}

      <AdminZyndPinSettingsSection />
    </div>
  );
}
