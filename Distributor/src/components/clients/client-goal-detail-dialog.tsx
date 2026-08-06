"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  isGoalInvested,
  resolveGoalCategoryIcon,
  resolveGoalCategoryLabel,
  resolveGoalStatusBadgeVariant,
  resolveGoalStatusLabel,
} from "@/lib/client-goal-ui";
import type { DistributorClientGoal } from "@/lib/distributor-types";
import { formatAum, formatDistributorDate } from "@/lib/format";
import {
  DISTRIBUTOR_INSET_SECTION_BODY_CLASS,
  DISTRIBUTOR_LABEL_CAPS_TINY_CLASS,
  DISTRIBUTOR_OVERLAY_HEADER_CLASS,
  DISTRIBUTOR_STACK_MD_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type ClientGoalDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: DistributorClientGoal | null;
};

export function ClientGoalDetailDialog({ open, onOpenChange, goal }: ClientGoalDetailDialogProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.goals;

  if (!goal) return null;

  const Icon = resolveGoalCategoryIcon(goal);
  const categoryLabel = resolveGoalCategoryLabel(goal);
  const invested = isGoalInvested(goal);
  const scopeLabel =
    goal.scope === "family" && goal.familyGroupName
      ? `${copy.family} · ${goal.familyGroupName}`
      : copy.personal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{goal.title}</DialogTitle>
        <DialogDescription>{copy.detailDescription}</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className={DISTRIBUTOR_OVERLAY_HEADER_CLASS}>
          <div className="flex items-start gap-3">
            <span className="distributor-client-goals-detail-dialog__icon" aria-hidden>
              <Icon className="size-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <h2 className="text-compact font-semibold">{goal.title}</h2>
              <p className="distributor-panel-card__description">{copy.detailDescription}</p>
            </div>
          </div>
        </div>

        <div className={cn(DISTRIBUTOR_INSET_SECTION_BODY_CLASS, DISTRIBUTOR_STACK_MD_CLASS)}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant="neutral">{categoryLabel}</StatusBadge>
            <StatusBadge variant={invested ? "success" : "neutral"}>
              {invested ? copy.investedBadge : copy.notInvestedBadge}
            </StatusBadge>
            <StatusBadge variant={resolveGoalStatusBadgeVariant(goal.status)}>
              {resolveGoalStatusLabel(goal.status)}
            </StatusBadge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-compact">
              <span className="text-muted-foreground">{copy.progress}</span>
              <span className="font-semibold tabular-nums">{goal.progressPct}%</span>
            </div>
            <div
              className="distributor-client-goals-tile__progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={goal.progressPct}
              aria-label={`${goal.progressPct}% ${copy.progress.toLowerCase()}`}
            >
              <div
                className="distributor-client-goals-tile__progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, goal.progressPct))}%` }}
              />
            </div>
            <p className="text-compact font-semibold tabular-nums">
              {formatAum(goal.currentAmount)} / {formatAum(goal.targetAmount)}
            </p>
          </div>

          <dl className="distributor-client-goals-detail-dialog__meta">
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{copy.scopeLabel}</dt>
              <dd className="mt-0.5 text-compact font-medium">{scopeLabel}</dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{copy.target}</dt>
              <dd className="mt-0.5 text-compact font-medium tabular-nums">
                {formatDistributorDate(goal.targetDate)}
              </dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{copy.savedSoFar}</dt>
              <dd className="mt-0.5 text-compact font-medium tabular-nums">
                {formatAum(goal.currentAmount)}
              </dd>
            </div>
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}
