"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AuthenticatorVerifyDialog,
  PasswordVerifyDialog,
} from "@/features/account/mfa";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { ApiError } from "@/lib/api-client";
import { cancelAccountDeletion, requestAccountDeletion } from "@/lib/auth-api";
import type { AuthUser } from "@/lib/auth-api";
import { copy } from "@/shared/config/copy";

type DeleteAccountSettingsPanelProps = {
  user: AuthUser;
  mfaEnabled: boolean;
  onUserRefresh: () => Promise<unknown>;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function formatScheduledDeletion(value: string | null) {
  if (!value) return "soon";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DeleteAccountSettingsPanel({
  user,
  mfaEnabled,
  onUserRefresh,
}: DeleteAccountSettingsPanelProps) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [authError, setAuthError] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  const resetDialogs = () => {
    setPendingPassword("");
    setPasswordError("");
    setAuthError("");
  };

  const submitDeletion = async (currentPassword: string, totpCode?: string) => {
    setLoading(true);
    setError("");
    setPasswordError("");
    setAuthError("");
    setSuccess("");

    try {
      const result = await requestAccountDeletion({
        currentPassword,
        totpCode,
      });
      resetDialogs();
      setPasswordDialogOpen(false);
      setAuthDialogOpen(false);
      setSuccess(
        result.deletion_scheduled_at
          ? copy.account.deletionScheduledSuccess(
              formatScheduledDeletion(result.deletion_scheduled_at)
            )
          : copy.account.deletionScheduledSuccessGeneric
      );
      await onUserRefresh();
    } catch (err) {
      const message = getErrorMessage(err, copy.account.deletionCouldNotRequest);
      if (authDialogOpen) {
        setAuthError(message);
      } else if (passwordDialogOpen) {
        setPasswordError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordVerify = (password: string) => {
    setPendingPassword(password);

    if (mfaEnabled) {
      setPasswordDialogOpen(false);
      setAuthDialogOpen(true);
      return;
    }

    void submitDeletion(password);
  };

  const handleAuthenticatorVerify = (totpCode: string) => {
    void submitDeletion(pendingPassword, totpCode);
  };

  const handleCancelDeletion = async () => {
    setCancelLoading(true);
    setError("");
    setSuccess("");
    try {
      await cancelAccountDeletion();
      setSuccess(copy.account.deletionCancelled);
      await onUserRefresh();
    } catch (err) {
      setError(getErrorMessage(err, copy.account.deletionCouldNotCancel));
    } finally {
      setCancelLoading(false);
    }
  };

  const isDeletionPending = user.account_status === "deletion_pending";

  return (
    <>
      <div className="space-y-5">
        {isDeletionPending ? (
          <div className="max-w-lg space-y-4">
            <div className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-compact font-semibold text-foreground">{copy.settings.deletionScheduledTitle}</p>
                <StatusBadge variant="warning">{copy.settings.deletionPendingBadge}</StatusBadge>
              </div>
              <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
                {copy.settings.deletionScheduledDescription(
                  formatScheduledDeletion(user.deletion_scheduled_at),
                )}
              </p>
            </div>

            <FieldMessage message={error} />
            {success ? <UiMessage variant="success" message={success} className="mt-0" /> : null}

            <Button
              variant="outline"
              disabled={cancelLoading}
              onClick={() => void handleCancelDeletion()}
            >
              {cancelLoading ? copy.settings.cancellingDeletion : copy.settings.cancelDeletionRequest}
            </Button>
          </div>
        ) : (
          <div className="max-w-lg space-y-4">
            <div className="rounded-[var(--radius-card)] border border-destructive/25 bg-destructive/5 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-4" />
                </div>
                <div className="space-y-2">
                  <p className="text-compact font-semibold text-foreground">
                    {copy.settings.deletionBeforeYouContinueTitle}
                  </p>
                  <ul className="list-disc space-y-1.5 pl-4 text-caption leading-relaxed text-muted-foreground">
                    <li>{copy.account.deletionGracePeriod()}</li>
                    <li>{copy.account.deletionCancelDuringGrace}</li>
                    <li>{copy.account.deletionPermanentAfterDays()}</li>
                  </ul>
                </div>
              </div>
            </div>

            <FieldMessage message={error} />
            {success ? <UiMessage variant="success" message={success} className="mt-0" /> : null}

            <Button
              variant="destructive"
              onClick={() => {
                resetDialogs();
                setPasswordDialogOpen(true);
              }}
            >
              <Trash2 className="size-3.5" />
              {copy.settings.requestAccountDeletion}
            </Button>
          </div>
        )}
      </div>

      <PasswordVerifyDialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) {
            setPasswordError("");
            if (!authDialogOpen) {
              setPendingPassword("");
            }
          }
        }}
        title={copy.settings.confirmAccountDeletionTitle}
        description={copy.account.deletionPasswordPrompt()}
        submitLabel={mfaEnabled ? "Continue" : copy.settings.requestDeletion}
        loading={loading && !authDialogOpen}
        error={passwordError}
        onSubmit={handlePasswordVerify}
      />

      <AuthenticatorVerifyDialog
        open={authDialogOpen}
        onOpenChange={(open) => {
          setAuthDialogOpen(open);
          if (!open) {
            setAuthError("");
            setPendingPassword("");
          }
        }}
        title={copy.settings.confirmAccountDeletionTitle}
        description={copy.settings.confirmAccountDeletionMfaDescription}
        submitLabel={copy.settings.requestDeletion}
        loading={loading}
        error={authError}
        onSubmit={handleAuthenticatorVerify}
      />
    </>
  );
}
