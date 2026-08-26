"use client";

import { Check, Copy, RefreshCw, Shield, ShieldCheck, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import QRCode from "react-qr-code";

import { OtpInput } from "@/components/auth/otp-input";
import { DistributorBackupCodesPanel } from "@/components/auth/distributor-backup-codes-panel";
import { DistributorMfaRegenerateBackupCodesDialog } from "@/components/settings/distributor-mfa-regenerate-backup-codes-dialog";
import { DistributorMfaResetDialog } from "@/components/settings/distributor-mfa-reset-dialog";
import { DistributorZyndPinSettingsSection } from "@/components/settings/distributor-zynd-pin-settings-section";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { Label } from "@/components/ui/label";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  mfaEnrollConfirm,
  mfaEnrollStart,
} from "@/lib/distributor-account-api";
import { ApiError } from "@/lib/api-client";

const MFA_SETUP_POINTS = [
  "Use Google Authenticator, Authy, or any TOTP app",
  "Required for signing in and for PIN lock setup",
  "Backup codes help you sign in if you lose your phone",
] as const;

function isValidOtp(value: string) {
  return /^\d{6}$/.test(value);
}

type DistributorMfaActionCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  action: ReactNode;
};

function DistributorMfaActionCard({
  title,
  description,
  icon: Icon,
  action,
}: DistributorMfaActionCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div className="space-y-2">
            <p className="text-compact font-semibold text-foreground">{title}</p>
            <p className="text-caption text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}

export function DistributorMfaSettingsSection() {
  const { user, refreshUser } = useDistributorAuth();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [enrollToken, setEnrollToken] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [enrollOtp, setEnrollOtp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  if (!user) return null;

  const mfaEnabled = Boolean(user.mfaEnrolled);

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
      setError(err instanceof ApiError ? err.message : "Could not start MFA enrollment.");
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not confirm MFA enrollment.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="space-y-6 border-t border-border pt-8">
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

      {!mfaEnabled ? (
        <div className="space-y-4 rounded-[var(--radius-card)] border border-border p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
                <Shield className="size-5" />
              </div>
              <div className="space-y-2">
                <p className="text-compact font-semibold text-foreground">Two-factor authentication</p>
                <p className="text-caption text-muted-foreground">
                  Protect your Zynd Mitra console account with an authenticator app.
                </p>
              </div>
            </div>

            {!enrollToken ? (
              <DistributorActionButton
                type="button"
                variant="primary"
                size="sm"
                className="shrink-0"
                disabled={actionLoading}
                onClick={() => void handleStartEnroll()}
              >
                <ShieldCheck className="size-3.5" />
                {actionLoading ? "Starting…" : "Set up authenticator"}
              </DistributorActionButton>
            ) : null}
          </div>

          {!enrollToken ? (
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

          {enrollToken ? (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-muted/50 px-2 py-0.5 text-caption font-medium text-muted-foreground">
                  Step 2 of 2 · Verify setup
                </span>
                <DistributorActionButton
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionLoading}
                  onClick={handleCancelEnroll}
                >
                  Cancel
                </DistributorActionButton>
              </div>

              <div className="rounded-[var(--radius-card)] border border-border bg-muted/20 p-4">
                {qrUri ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-[var(--radius-control)] border border-border bg-card p-3 shadow-zynd-low">
                      <QRCode value={qrUri} size={140} />
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
                    <DistributorActionButton
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Copy setup key"
                      onClick={() => void handleCopySecret()}
                    >
                      {copiedSecret ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                    </DistributorActionButton>
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
                <DistributorActionButton
                  type="button"
                  variant="outline"
                  disabled={actionLoading}
                  onClick={handleCancelEnroll}
                >
                  Back
                </DistributorActionButton>
                <DistributorActionButton
                  type="button"
                  variant="primary"
                  disabled={actionLoading || !isValidOtp(enrollOtp)}
                  onClick={() => void handleConfirmEnroll()}
                >
                  {actionLoading ? "Confirming…" : "Enable MFA"}
                </DistributorActionButton>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {backupCodes.length ? <DistributorBackupCodesPanel codes={backupCodes} className="mt-2" /> : null}

      {mfaEnabled ? (
        <div className="space-y-4">
          <DistributorMfaActionCard
            title="Regenerate backup codes"
            description="Generate a fresh set of one-time backup codes. Previous codes will stop working."
            icon={RefreshCw}
            action={
              <DistributorActionButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRegenerateOpen(true)}
              >
                Regenerate codes
              </DistributorActionButton>
            }
          />

          <DistributorMfaActionCard
            title="Change authenticator"
            description="Set up a new authenticator app. You will need a code from your current app to continue."
            icon={ShieldCheck}
            action={
              <DistributorActionButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetOpen(true)}
              >
                Change authenticator
              </DistributorActionButton>
            }
          />
        </div>
      ) : null}

      <DistributorMfaRegenerateBackupCodesDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        onUpdated={() => {
          void refreshUser();
        }}
      />

      <DistributorMfaResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onCompleted={() => {
          void refreshUser();
        }}
      />

      <DistributorZyndPinSettingsSection />
    </section>
  );
}
