"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";
import { StatusBadge } from "@/components/ui/status-badge";
import { pickUserRef } from "@/lib/admin-user-ref";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format-date";
import {
  buildUnlockJourneyDisplaySteps,
  type UnlockJourneyDisplayStep,
} from "@/lib/risk-profile-unlock-journey-copy";
import {
  fetchRiskProfileUnlockJourney,
  type LockedRiskProfileUser,
  type RiskProfileUnlockJourney,
} from "@/lib/risk-profile-admin-api";
import { cn } from "@/lib/utils";
import { LockedProfileUserCell } from "@/components/risk-profile/risk-profile-locked-user-cell";

function UnlockJourneyTimelineStep({
  step,
  isLast,
}: {
  step: UnlockJourneyDisplayStep;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex w-timeline-rail flex-col items-center self-stretch">
        <span
          className={cn(
            "relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full border",
            step.isTerminal ? "border-destructive/40 bg-destructive/10" : "border-border bg-card",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              step.badgeVariant === "success"
                ? "bg-success"
                : step.badgeVariant === "destructive"
                  ? "bg-destructive"
                  : step.badgeVariant === "warning"
                    ? "bg-warning"
                    : "bg-primary",
            )}
          />
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
      </div>
      <div
        className={cn(
          "mb-5 min-w-0 flex-1 rounded-[var(--radius-control)] border px-3 py-3",
          step.isTerminal ? "border-destructive/35 bg-destructive/5" : "border-border/70 bg-muted/10",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{step.title}</p>
          <StatusBadge variant={step.badgeVariant} showIcon className="normal-case">
            {step.status}
          </StatusBadge>
        </div>
        {step.description ? (
          <p className="mt-1.5 text-compact leading-relaxed text-muted-foreground">{step.description}</p>
        ) : null}
        <p className="mt-2 text-caption text-muted-foreground">
          {formatTimestamp(step.created_at)} · {step.actor}
        </p>
      </div>
    </div>
  );
}

function AttemptStateSummary({ journey }: { journey: RiskProfileUnlockJourney }) {
  const state = journey.attempt_state;
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-muted/15 px-3 py-2 text-compact">
      <p className="font-medium text-foreground">Current attempt state</p>
      <p className="mt-1 text-muted-foreground">
        Completed {state.completed_count} of {state.granted_attempts} granted attempts
        {state.is_locked ? " · Locked" : ` · ${state.attempts_remaining} remaining`}
      </p>
      {state.locked_at ? (
        <p className="mt-1 text-caption text-muted-foreground">
          Locked at {formatTimestamp(state.locked_at)}
        </p>
      ) : null}
    </div>
  );
}

export function RiskProfileUnlockJourneyDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: LockedRiskProfileUser | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [journey, setJourney] = useState<RiskProfileUnlockJourney | null>(null);

  useEffect(() => {
    if (!open || !user) {
      setJourney(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void fetchRiskProfileUnlockJourney(pickUserRef(user))
      .then((result) => {
        if (!cancelled) setJourney(result);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, "Could not load unlock journey."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  if (!open || !user) return null;

  const steps = journey ? buildUnlockJourneyDisplaySteps(journey.steps) : [];

  return (
    <AdminDetailDialog
      open={open}
      onClose={onClose}
      title="Unlock journey"
      description="Lock events, unlock codes sent, failed confirmations, and granted attempts."
      icon={History}
      iconTone="info"
    >
      {loading ? (
        <AdminDetailDialogSkeleton />
      ) : error ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
            <LockedProfileUserCell user={user} />
          </div>

          {journey ? <AttemptStateSummary journey={journey} /> : null}

          {steps.length === 0 ? (
            <p className="text-compact text-muted-foreground">No unlock activity recorded yet.</p>
          ) : (
            <div>
              <p className="mb-3 text-compact font-semibold text-foreground">Timeline</p>
              {steps.map((step, index) => (
                <UnlockJourneyTimelineStep key={step.id} step={step} isLast={index === steps.length - 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </AdminDetailDialog>
  );
}
