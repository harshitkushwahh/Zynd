"use client";

import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { PasswordCriteriaList } from "@/components/auth/password-criteria-list";
import { PasswordInput } from "@/components/auth/password-input";
import { OtpInput } from "@/components/auth/otp-input";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { changeAdminPassword } from "@/lib/admin-account-api";
import { isValidOtp, isValidPassword } from "@/lib/admin-validation";

type AdminChangePasswordSettingsPanelProps = {
  mfaEnabled: boolean;
  onSessionsRefresh: () => Promise<void>;
};


export function AdminChangePasswordSettingsPanel({
  mfaEnabled,
  onSessionsRefresh,
}: AdminChangePasswordSettingsPanelProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMfaStep, setShowMfaStep] = useState(false);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setTotpCode("");
    setShowMfaStep(false);
  };

  const submit = async (code?: string) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await changeAdminPassword({
        currentPassword,
        newPassword,
        totpCode: code,
      });
      resetForm();
      setMessage("Password updated. Other sessions were signed out.");
      await onSessionsRefresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not change password."));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isValidPassword(newPassword)) {
      setError("Choose a stronger password that meets the platform requirements.");
      return;
    }

    if (mfaEnabled && !showMfaStep) {
      setShowMfaStep(true);
      return;
    }

    if (mfaEnabled && !isValidOtp(totpCode)) {
      setError("Enter a valid authenticator code.");
      return;
    }

    void submit(mfaEnabled ? totpCode : undefined);
  };

  const canSubmit =
    currentPassword.length > 0 &&
    isValidPassword(newPassword) &&
    !loading &&
    (!mfaEnabled || !showMfaStep || isValidOtp(totpCode));

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-border bg-muted/10 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-compact font-semibold text-foreground">Keep your account secure</p>
            <p className="text-caption text-muted-foreground">
              Changing your password signs out other active sessions.
            </p>
          </div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-4 rounded-[var(--radius-card)] border border-border p-4">
          <div className="space-y-2">
            <Label htmlFor="admin-settings-current-password">Current password</Label>
            <PasswordInput
              id="admin-settings-current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-settings-new-password">New password</Label>
            <PasswordInput
              id="admin-settings-new-password"
              icon={LockKeyhole}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
            {newPassword ? <PasswordCriteriaList password={newPassword} /> : null}
          </div>
          {showMfaStep ? (
            <div className="space-y-2">
              <Label htmlFor="admin-settings-password-mfa">Authenticator code</Label>
              <OtpInput
                id="admin-settings-password-mfa"
                value={totpCode}
                onChange={setTotpCode}
              />
            </div>
          ) : null}
        </div>

        {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
        {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

        <Button type="submit" disabled={!canSubmit}>
          <KeyRound className="size-3.5" />
          {loading ? "Updating…" : showMfaStep ? "Confirm with MFA" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
