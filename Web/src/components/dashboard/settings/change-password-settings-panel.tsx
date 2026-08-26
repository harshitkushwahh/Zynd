"use client";

import { KeyRound, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { ChangePasswordVerifyDialog } from "@/components/dashboard/settings/change-password-dialog";
import { PasswordCriteriaList } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
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
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [success, setSuccess] = useState("");

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setError("");
    setVerifyError("");
  };

  const submitPasswordChange = async (verification?: StepUpVerification) => {
    setLoading(true);
    setError("");
    setVerifyError("");

    try {
      await changePassword({
        currentPassword,
        newPassword,
        totpCode: verification?.totpCode,
        smsOtp: verification?.smsOtp,
      });
      resetForm();
      setVerifyOpen(false);
      setSuccess(copy.settings.changePasswordSuccess);
      await onSessionsRefresh();
    } catch (err) {
      const message = getErrorMessage(err, copy.settings.changePasswordFailed);
      if (verifyOpen) {
        setVerifyError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!isPasswordValid(newPassword)) {
      setError(copy.settings.changePasswordWeakError);
      return;
    }

    if (mfaEnabled) {
      setError("");
      setVerifyOpen(true);
      return;
    }

    void submitPasswordChange();
  };

  const handleVerifySubmit = (verification: StepUpVerification) => {
    void submitPasswordChange(verification);
  };

  const canSubmit =
    currentPassword.length > 0 && isPasswordValid(newPassword) && !loading;

  return (
    <>
      <div className="space-y-6">
        {success ? <UiMessage variant="success" message={success} className="mt-0" /> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5">
            <div className="space-y-2">
              <Label htmlFor="settings-change-password-current">
                {copy.settings.changePasswordCurrentLabel}
              </Label>
              <PasswordInput
                id="settings-change-password-current"
                icon={KeyRound}
                placeholder={copy.settings.changePasswordCurrentPlaceholder}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-change-password-new">
                {copy.settings.changePasswordNewLabel}
              </Label>
              <PasswordInput
                id="settings-change-password-new"
                icon={LockKeyhole}
                placeholder={copy.settings.changePasswordNewPlaceholder}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
              {newPassword ? <PasswordCriteriaList password={newPassword} /> : null}
            </div>
          </div>

          <FieldMessage message={error} />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <UiMessage
              variant="info"
              message={copy.settings.changePasswordStaySignedIn}
              className="mt-0 w-fit max-w-md"
            />
            <Button type="submit" disabled={!canSubmit} className="w-full shrink-0 sm:w-auto">
              <KeyRound className="size-3.5" />
              {loading && !verifyOpen
                ? copy.settings.changePasswordSubmitting
                : copy.settings.changePasswordSubmit}
            </Button>
          </div>
        </form>
      </div>

      <ChangePasswordVerifyDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        loading={loading}
        error={verifyError}
        onErrorChange={setVerifyError}
        onSubmit={handleVerifySubmit}
      />
    </>
  );
}
