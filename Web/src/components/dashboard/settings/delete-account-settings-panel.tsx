"use client";

import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { DeleteAccountRequestDialog } from "@/components/dashboard/settings/delete-account-request-dialog";
import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { ApiError } from "@/lib/api-client";
import { cancelAccountDeletion, requestAccountDeletion } from "@/lib/auth-api";
import type { AuthUser } from "@/lib/auth-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

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
  if (!value) return "Soon";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const DELETION_STEPS = [
  {
    icon: Clock3,
    title: copy.settings.deletionStepGraceTitle(),
    description: copy.settings.deletionStepGraceDescription,
  },
  {
    icon: RotateCcw,
    title: copy.settings.deletionStepCancelTitle,
    description: copy.settings.deletionStepCancelDescription,
  },
  {
    icon: Trash2,
    title: copy.settings.deletionStepFinalTitle,
    description: copy.settings.deletionStepFinalDescription(),
  },
] as const;

function DeletionStepCard({
  icon: Icon,
  title,
  description,
  step,
}: {
  icon: typeof Clock3;
  title: string;
  description: string;
  step: number;
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-muted/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-background text-muted-foreground ring-1 ring-border">
          <Icon className="size-4" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Step {step}
        </span>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-compact font-semibold text-foreground">{title}</p>
        <p className="text-caption leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
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

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestError, setRequestError] = useState("");

  const resetDialogs = () => {
    setRequestError("");
  };

  const submitDeletion = async (
    currentPassword: string,
    verification?: StepUpVerification,
  ) => {
    setLoading(true);
    setError("");
    setRequestError("");
    setSuccess("");

    try {
      const result = await requestAccountDeletion({
        currentPassword,
        totpCode: verification?.totpCode,
        smsOtp: verification?.smsOtp,
      });
      resetDialogs();
      setRequestDialogOpen(false);
      setSuccess(
        result.deletion_scheduled_at
          ? copy.account.deletionScheduledSuccess(
              formatScheduledDeletion(result.deletion_scheduled_at),
            )
          : copy.account.deletionScheduledSuccessGeneric,
      );
      await onUserRefresh();
    } catch (err) {
      setRequestError(getErrorMessage(err, copy.account.deletionCouldNotRequest));
    } finally {
      setLoading(false);
    }
  };

  const handleDeletionSubmit = (password: string, verification?: StepUpVerification) => {
    void submitDeletion(password, verification);
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
  const scheduledFor = formatScheduledDeletion(user.deletion_scheduled_at);

  return (
    <>
      <div className="w-full space-y-6">
        {isDeletionPending ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-warning/30 bg-gradient-to-br from-warning/5 via-card to-warning/10">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-warning/15 text-warning">
                    <CalendarClock className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-compact font-semibold text-foreground">
                        {copy.settings.deletionScheduledTitle}
                      </p>
                      <StatusBadge variant="warning">{copy.settings.deletionPendingBadge}</StatusBadge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
                        {copy.settings.deletionScheduledDateLabel}
                      </p>
                      <p className="text-h4 font-semibold text-foreground">{scheduledFor}</p>
                    </div>
                    <p className="text-caption leading-relaxed text-muted-foreground">
                      {copy.settings.deletionScheduledBodyHint}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:min-w-72">
                <div className="rounded-[var(--radius-card)] border border-border bg-muted/10 px-5 py-4">
                  <p className="text-caption leading-relaxed text-muted-foreground">
                    {copy.settings.deletionKeepAccountHint}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled={cancelLoading}
                  onClick={() => void handleCancelDeletion()}
                >
                  <RotateCcw className="size-3.5" />
                  {cancelLoading ? copy.settings.cancellingDeletion : copy.settings.cancelDeletionRequest}
                </Button>
              </div>
            </div>

            <FieldMessage message={error} />
            {success ? <UiMessage variant="success" message={success} className="mt-0" /> : null}
          </>
        ) : (
          <>
            <section className="space-y-3">
              <h3 className="text-compact font-semibold text-foreground">
                {copy.settings.deletionHowItWorksTitle}
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                {DELETION_STEPS.map((step, index) => (
                  <DeletionStepCard
                    key={step.title}
                    icon={step.icon}
                    title={step.title}
                    description={step.description}
                    step={index + 1}
                  />
                ))}
              </div>
            </section>

            <section
              className={cn(
                "rounded-[var(--radius-card)] border border-destructive/25 bg-destructive/5 p-5 sm:p-6",
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-destructive/10 text-destructive">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-compact font-semibold text-foreground">
                      {copy.settings.deletionActionTitle}
                    </p>
                    <p className="text-caption leading-relaxed text-muted-foreground">
                      {copy.settings.deletionActionDescription}
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  className="w-full shrink-0 lg:w-auto"
                  onClick={() => {
                    resetDialogs();
                    setRequestDialogOpen(true);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  {copy.settings.requestAccountDeletion}
                </Button>
              </div>
            </section>

            <FieldMessage message={error} />
            {success ? <UiMessage variant="success" message={success} className="mt-0" /> : null}
          </>
        )}
      </div>

      <DeleteAccountRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        mfaEnabled={mfaEnabled}
        loading={loading}
        error={requestError}
        onErrorChange={setRequestError}
        onSubmit={handleDeletionSubmit}
      />
    </>
  );
}
