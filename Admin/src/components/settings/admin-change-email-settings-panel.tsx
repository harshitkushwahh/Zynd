"use client";

import { ArrowLeft, KeyRound, Mail, MailCheck } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { OtpInput } from "@/components/auth/otp-input";
import { PasswordInput } from "@/components/auth/password-input";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeAdminEmailConfirm,
  changeAdminEmailResend,
  changeAdminEmailStart,
} from "@/lib/admin-account-api";
import { isValidEmail, isValidOtp, isValidPassword } from "@/lib/admin-validation";
import { ApiError } from "@/lib/api-client";

type AdminChangeEmailSettingsPanelProps = {
  currentEmail: string;
  mfaEnabled: boolean;
  onUserRefresh: () => Promise<unknown>;
  onSessionsRefresh: () => Promise<void>;
};


export function AdminChangeEmailSettingsPanel({
  currentEmail,
  mfaEnabled,
  onUserRefresh,
  onSessionsRefresh,
}: AdminChangeEmailSettingsPanelProps) {
  const [step, setStep] = useState<"form" | "confirm" | "mfa">("form");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [changeToken, setChangeToken] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const submitStart = async (code?: string) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await changeAdminEmailStart({
        newEmail,
        currentPassword,
        totpCode: code,
      });
      setChangeToken(result.change_token);
      setResendCooldown(result.retry_after_seconds);
      setOtp("");
      setStep("confirm");
      setMessage("Verification code sent to your new email address.");
    } catch (err) {
      if (err instanceof ApiError && err.retryAfterSeconds) {
        setResendCooldown(err.retryAfterSeconds);
      }
      setError(getErrorMessage(err, "Could not start email change."));
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isValidEmail(newEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setError("New email must be different from your current email.");
      return;
    }
    if (!isValidPassword(currentPassword)) {
      setError("Enter your current password.");
      return;
    }
    if (mfaEnabled && step !== "mfa") {
      setStep("mfa");
      return;
    }
    if (mfaEnabled && !isValidOtp(totpCode)) {
      setError("Enter a valid authenticator code.");
      return;
    }
    void submitStart(mfaEnabled ? totpCode : undefined);
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidOtp(otp)) {
      setError("Enter the verification code from your email.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await changeAdminEmailConfirm(changeToken, otp);
      await onUserRefresh();
      await onSessionsRefresh();
      setMessage("Email updated successfully.");
      setStep("form");
      setNewEmail("");
      setCurrentPassword("");
      setChangeToken("");
      setOtp("");
    } catch (err) {
      setError(getErrorMessage(err, "Could not confirm email change."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!changeToken || resendCooldown > 0) return;
    setLoading(true);
    setError("");
    try {
      const result = await changeAdminEmailResend(changeToken);
      setResendCooldown(result.retry_after_seconds);
      setMessage("Verification code resent.");
    } catch (err) {
      if (err instanceof ApiError && err.retryAfterSeconds) {
        setResendCooldown(err.retryAfterSeconds);
      }
      setError(getErrorMessage(err, "Could not resend code."));
    } finally {
      setLoading(false);
    }
  };

  if (step === "confirm") {
    return (
      <form className="space-y-4" onSubmit={(event) => void handleConfirm(event)}>
        <AdminFeedbackMessage variant="info">
          Enter the code sent to <strong>{newEmail}</strong>
        </AdminFeedbackMessage>
        <div className="space-y-2">
          <Label htmlFor="admin-email-otp">Verification code</Label>
          <OtpInput id="admin-email-otp" value={otp} onChange={setOtp} />
        </div>
        {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
        {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading || !isValidOtp(otp)}>
            <MailCheck className="size-3.5" />
            {loading ? "Confirming…" : "Confirm new email"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading || resendCooldown > 0}
            onClick={() => void handleResend()}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep("form")}>
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleFormSubmit}>
      <div className="rounded-[var(--radius-card)] border border-border bg-muted/10 px-4 py-3 text-caption text-muted-foreground">
        Current email: <span className="font-medium text-foreground">{currentEmail}</span>
      </div>

      <div className="space-y-4 rounded-[var(--radius-card)] border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="admin-new-email">New email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-new-email"
              type="email"
              className="pl-9"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-email-password">Current password</Label>
          <PasswordInput
            id="admin-email-password"
            icon={KeyRound}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>
        {step === "mfa" ? (
          <div className="space-y-2">
            <Label htmlFor="admin-email-mfa">Authenticator code</Label>
            <OtpInput id="admin-email-mfa" value={totpCode} onChange={setTotpCode} />
          </div>
        ) : null}
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Sending…" : step === "mfa" ? "Continue with MFA" : "Send verification code"}
      </Button>
    </form>
  );
}
