"use client";

import {
  ArrowLeft,
  KeyRound,
  Mail,
  MailCheck,
} from "lucide-react";
import { useState } from "react";

import { AuthenticatorVerifyDialog } from "@/features/account/mfa";
import { SettingsDetailSection } from "@/components/dashboard/settings/settings-detail-row";
import { OtpInput } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { ApiError } from "@/lib/api-client";
import { changeEmailConfirm, changeEmailResend, changeEmailStart } from "@/lib/auth-api";
import { useOtpResendCooldown } from "@/hooks/use-otp-resend-cooldown";
import { isValidEmail } from "@/lib/password-criteria";
import { copy } from "@/shared/config/copy";
import { storageKeys } from "@/shared/config/storage-keys";
import { cn } from "@/lib/utils";

type ChangeEmailSettingsPanelProps = {
  currentEmail: string;
  mfaEnabled: boolean;
  onUserRefresh: () => Promise<unknown>;
  onSessionsRefresh: () => Promise<void>;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function IconInput({
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: typeof Mail }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn("h-10 pl-9", className)} {...props} />
    </div>
  );
}

export function ChangeEmailSettingsPanel({
  currentEmail,
  mfaEnabled,
  onUserRefresh,
  onSessionsRefresh,
}: ChangeEmailSettingsPanelProps) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [changeToken, setChangeToken] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const otpCooldown = useOtpResendCooldown(storageKeys.changeEmailOtpCooldown);

  const resetForm = () => {
    setNewEmail("");
    setCurrentPassword("");
    setChangeToken("");
    setOtp("");
    setStep("form");
  };

  const submitEmailStart = async (totpCode?: string) => {
    setLoading(true);
    setError("");
    setAuthError("");
    setSuccess("");

    try {
      const result = await changeEmailStart({
        newEmail,
        currentPassword,
        totpCode,
      });
      setChangeToken(result.change_token);
      otpCooldown.startCooldown(result.retry_after_seconds);
      setOtp("");
      setStep("confirm");
      setSuccess(copy.settings.changeEmailCodeSent);
      setAuthDialogOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        otpCooldown.syncFromError(err.retryAfterSeconds);
      }
      const message = getErrorMessage(err, copy.settings.changeEmailStartFailed);
      if (authDialogOpen) {
        setAuthError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!isValidEmail(newEmail)) {
      setError(copy.settings.changeEmailInvalid);
      return;
    }

    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setError(copy.settings.changeEmailSameError);
      return;
    }

    if (mfaEnabled) {
      setAuthDialogOpen(true);
      return;
    }

    void submitEmailStart();
  };

  const handleAuthenticatorVerify = (totpCode: string) => {
    void submitEmailStart(totpCode);
  };

  const handleResendCode = async () => {
    if (!otpCooldown.canResend || loading || !changeToken) return;

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await changeEmailResend(changeToken);
      otpCooldown.startCooldown(result.retry_after_seconds);
      setOtp("");
      setSuccess(copy.settings.changeEmailResendSuccess);
    } catch (err) {
      if (err instanceof ApiError) {
        otpCooldown.syncFromError(err.retryAfterSeconds);
      }
      setError(getErrorMessage(err, copy.settings.changeEmailResendFailed));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await changeEmailConfirm(changeToken, otp);
      resetForm();
      setSuccess(copy.settings.changeEmailSuccess);
      await onUserRefresh();
      await onSessionsRefresh();
    } catch (err) {
      setError(getErrorMessage(err, copy.settings.changeEmailConfirmFailed));
    } finally {
      setLoading(false);
    }
  };

  const canSubmitForm =
    isValidEmail(newEmail) &&
    newEmail.trim().toLowerCase() !== currentEmail.toLowerCase() &&
    currentPassword.length > 0 &&
    !loading;

  return (
    <>
      <div className="space-y-6">
        {step === "form" ? (
            <form className="space-y-6" onSubmit={handleFormSubmit}>
              <SettingsDetailSection title={copy.settings.changeEmailCurrentLabel}>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-background text-muted-foreground ring-1 ring-border">
                    <Mail className="size-4" />
                  </div>
                  <p className="min-w-0 truncate text-body font-medium text-foreground">
                    {currentEmail}
                  </p>
                </div>
              </SettingsDetailSection>

              <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5">
                <div className="space-y-2">
                  <Label htmlFor="settings-new-email">
                    {copy.settings.changeEmailNewLabel}
                  </Label>
                  <IconInput
                    id="settings-new-email"
                    icon={MailCheck}
                    type="email"
                    placeholder={copy.settings.changeEmailNewPlaceholder}
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-email-password">
                    {copy.settings.changeEmailPasswordLabel}
                  </Label>
                  <PasswordInput
                    id="settings-email-password"
                    icon={KeyRound}
                    placeholder={copy.settings.changeEmailPasswordPlaceholder}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <FieldMessage message={error} />
              {success ? <UiMessage variant="success" message={success} className="mt-0" /> : null}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <UiMessage
                  variant="info"
                  message={copy.settings.changeEmailCodeInfo}
                  className="mt-0 w-fit max-w-md"
                />
                <Button type="submit" disabled={!canSubmitForm} className="w-full shrink-0 sm:w-auto">
                  <Mail className="size-3.5" />
                  {loading && !authDialogOpen
                    ? copy.settings.changeEmailSubmitting
                    : copy.settings.changeEmailSubmit}
                </Button>
              </div>
            </form>
        ) : (
          <>
            <div className="rounded-[var(--radius-card)] border border-border bg-muted/10 px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-info/10 text-info">
                  <MailCheck className="size-5" />
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-compact font-semibold text-foreground">
                    {copy.settings.changeEmailVerifyTitle}
                  </p>
                  <p className="text-caption leading-relaxed text-muted-foreground">
                    {copy.auth.otpEmailChange}{" "}
                    <span className="font-medium text-foreground">{newEmail}</span>
                  </p>
                </div>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleConfirmSubmit}>
              <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5">
                <div className="flex justify-center py-2">
                  <OtpInput value={otp} onChange={setOtp} id="settings-email-otp" />
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    className="text-caption font-medium text-primary transition-colors hover:text-primary/80 disabled:pointer-events-none disabled:opacity-50"
                    disabled={!otpCooldown.canResend || loading}
                    onClick={() => void handleResendCode()}
                  >
                    {otpCooldown.canResend
                      ? copy.settings.changeEmailResend
                      : copy.settings.changeEmailResendIn(otpCooldown.secondsLeft)}
                  </button>
                </div>
              </div>

              <FieldMessage message={error} />
              {success ? <UiMessage variant="success" message={success} className="mt-0" /> : null}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setStep("form");
                    setOtp("");
                    setError("");
                    setSuccess("");
                  }}
                >
                  <ArrowLeft className="size-3.5" />
                  {copy.settings.changeEmailBack}
                </Button>
                <Button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full sm:w-auto"
                >
                  <MailCheck className="size-3.5" />
                  {loading
                    ? copy.settings.changeEmailConfirmSubmitting
                    : copy.settings.changeEmailConfirmSubmit}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>

      <AuthenticatorVerifyDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        title={copy.settings.changeEmailMfaTitle}
        description={copy.settings.changeEmailMfaDescription}
        submitLabel={copy.settings.changeEmailSubmit}
        loading={loading}
        error={authError}
        onSubmit={handleAuthenticatorVerify}
      />
    </>
  );
}
