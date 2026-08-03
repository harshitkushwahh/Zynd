"use client";

import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AuthenticatorVerifyDialog } from "@/features/account/mfa";
import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
import { PasswordCriteriaList } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { ApiError } from "@/lib/api-client";
import { changePassword } from "@/lib/auth-api";
import { isPasswordValid } from "@/lib/password-criteria";
import { copy } from "@/shared/config/copy";

type ChangePasswordSettingsPanelProps = {
  mfaEnabled: boolean;
  onSessionsRefresh: () => Promise<void>;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

export function ChangePasswordSettingsPanel({
  mfaEnabled,
  onSessionsRefresh,
}: ChangePasswordSettingsPanelProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authError, setAuthError] = useState("");

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
  };

  const submitPasswordChange = async (verification?: StepUpVerification) => {
    setLoading(true);
    setError("");
    setAuthError("");
    setSuccess("");

    try {
      await changePassword({
        currentPassword,
        newPassword,
        totpCode: verification?.totpCode,
        smsOtp: verification?.smsOtp,
      });
      resetForm();
      setSuccess(copy.settings.changePasswordSuccess);
      setAuthDialogOpen(false);
      await onSessionsRefresh();
    } catch (err) {
      const message = getErrorMessage(err, copy.settings.changePasswordFailed);
      if (authDialogOpen) {
        setAuthError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!isPasswordValid(newPassword)) {
      setError(copy.settings.changePasswordWeakError);
      return;
    }

    if (mfaEnabled) {
      setAuthDialogOpen(true);
      return;
    }

    void submitPasswordChange();
  };

  const handleStepUpVerify = (verification: StepUpVerification) => {
    void submitPasswordChange(verification);
  };

  const canSubmit =
    currentPassword.length > 0 && isPasswordValid(newPassword) && !loading;

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-[var(--radius-card)] border border-border bg-muted/10 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-compact font-semibold text-foreground">
                {copy.settings.changePasswordSecurityTitle}
              </p>
              <p className="text-caption leading-relaxed text-muted-foreground">
                {copy.settings.changePasswordSecurityHint}
              </p>
            </div>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5">
            <div className="space-y-2">
              <Label htmlFor="settings-current-password">
                {copy.settings.changePasswordCurrentLabel}
              </Label>
              <PasswordInput
                id="settings-current-password"
                icon={KeyRound}
                placeholder={copy.settings.changePasswordCurrentPlaceholder}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-new-password">
                {copy.settings.changePasswordNewLabel}
              </Label>
              <PasswordInput
                id="settings-new-password"
                icon={LockKeyhole}
                placeholder={copy.settings.changePasswordNewPlaceholder}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            {newPassword ? <PasswordCriteriaList password={newPassword} /> : null}
          </div>

          <FieldMessage message={error} />
          {success ? <UiMessage variant="success" message={success} className="mt-0" /> : null}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <UiMessage
              variant="info"
              message={copy.settings.changePasswordStaySignedIn}
              className="mt-0 w-fit max-w-md"
            />
            <Button type="submit" disabled={!canSubmit} className="w-full shrink-0 sm:w-auto">
              <KeyRound className="size-3.5" />
              {loading && !authDialogOpen
                ? copy.settings.changePasswordSubmitting
                : copy.settings.changePasswordSubmit}
            </Button>
          </div>
        </form>
      </div>

      <AuthenticatorVerifyDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        title={copy.settings.changePasswordMfaTitle}
        description={copy.settings.changePasswordMfaDescription}
        submitLabel={copy.settings.changePasswordSubmit}
        loading={loading}
        error={authError}
        onSubmit={handleStepUpVerify}
      />
    </>
  );
}
