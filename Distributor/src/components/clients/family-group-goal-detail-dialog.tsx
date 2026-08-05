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
  resolveGoalPriorityBadgeVariant,
  resolveGoalPriorityLabel,
  resolveGoalStatusBadgeVariant,
  resolveGoalStatusLabel,
  resolveGoalTypeLabel,
  resolveGoalProgressPct,
} from "@/lib/client-goal-ui";
import type { DistributorClientGoal } from "@/lib/dummy/types";
import { formatAum, formatDistributorDate } from "@/lib/format";
import {
  DISTRIBUTOR_INSET_SECTION_BODY_CLASS,
  DISTRIBUTOR_LABEL_CAPS_TINY_CLASS,
  DISTRIBUTOR_OVERLAY_HEADER_CLASS,
  DISTRIBUTOR_STACK_MD_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type FamilyGroupGoalDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: DistributorClientGoal | null;
};

function memberShareOfGoal(amount: number, goalInvestedTotal: number): number {
  if (goalInvestedTotal <= 0) return 0;
  return Math.round((amount / goalInvestedTotal) * 100);
}

export function FamilyGroupGoalDetailDialog({
  open,
  onOpenChange,
  goal,
}: FamilyGroupGoalDetailDialogProps) {
  const familyCopy = DISTRIBUTOR_CLIENT_COPY.family;
  const goalsCopy = DISTRIBUTOR_CLIENT_COPY.goals;

  if (!goal) return null;

  const Icon = resolveGoalCategoryIcon(goal);
  const goalTypeLabel = resolveGoalTypeLabel(goal);
  const invested = isGoalInvested(goal);
  const priority = goal.priority ?? "medium";
  const contributions = goal.memberContributions ?? [];
  const investedTotal = goal.currentAmount;
  const progressPct = resolveGoalProgressPct(goal);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{goal.title}</DialogTitle>
        <DialogDescription>{goal.title}</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-lg gap-0 p-0">
        <div className={DISTRIBUTOR_OVERLAY_HEADER_CLASS}>
          <div className="flex items-start gap-3">
            <span className="distributor-client-goals-detail-dialog__icon" aria-hidden>
              <Icon className="size-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <h2 className="text-compact font-semibold">{goal.title}</h2>
              {goal.createdByDisplayName ? (
                <p className="mt-1.5 text-caption text-muted-foreground">
                  {familyCopy.familyGoalCreatedBy}{" "}
                  <span className="font-medium text-foreground">{goal.createdByDisplayName}</span>
                  {goal.createdByRole === "owner" ? (
                    <> · {familyCopy.familyGoalCreatedByOwner}</>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className={cn(DISTRIBUTOR_INSET_SECTION_BODY_CLASS, DISTRIBUTOR_STACK_MD_CLASS)}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant="neutral">{goalTypeLabel}</StatusBadge>
            <StatusBadge variant={resolveGoalPriorityBadgeVariant(priority)}>
              {resolveGoalPriorityLabel(priority)}
            </StatusBadge>
            <StatusBadge variant={invested ? "success" : "neutral"}>
              {invested ? goalsCopy.investedBadge : goalsCopy.notInvestedBadge}
            </StatusBadge>
            <StatusBadge variant={resolveGoalStatusBadgeVariant(goal.status)}>
              {resolveGoalStatusLabel(goal.status)}
            </StatusBadge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-compact">
              <span className="text-muted-foreground">{goalsCopy.progress}</span>
              <span className="font-semibold tabular-nums">{progressPct}%</span>
            </div>
            <div
              className="distributor-client-goals-tile__progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPct}
            >
              <div
                className="distributor-client-goals-tile__progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-compact font-semibold tabular-nums">
              {formatAum(goal.currentAmount)} / {formatAum(goal.targetAmount)}
            </p>
          </div>

          <dl className="distributor-client-goals-detail-dialog__meta">
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{familyCopy.familyGoalTypeLabel}</dt>
              <dd className="mt-0.5 text-compact font-medium">{goalTypeLabel}</dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>
                {familyCopy.familyGoalPriorityLabel}
              </dt>
              <dd className="mt-0.5 text-compact font-medium">
                {resolveGoalPriorityLabel(priority)}
              </dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>
                {familyCopy.familyGoalAmountInvested}
              </dt>
              <dd className="mt-0.5 text-compact font-medium tabular-nums">
                {formatAum(goal.currentAmount)}
              </dd>
            </div>
            <div>
              <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{goalsCopy.target}</dt>
              <dd className="mt-0.5 text-compact font-medium tabular-nums">
                {formatDistributorDate(goal.targetDate)}
              </dd>
            </div>
          </dl>

          <div className="distributor-family-group-goal-detail__members">
            <h3 className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>
              {familyCopy.familyGoalMembersInvested}
            </h3>
            {contributions.length === 0 ? (
              <p className="mt-2 text-compact text-muted-foreground">{goalsCopy.notInvestedBadge}</p>
            ) : (
              <ul className="distributor-family-group-goal-detail__member-list">
                {contributions.map((entry) => {
                  const sharePct = memberShareOfGoal(entry.amount, investedTotal);
                  return (
                    <li key={entry.userId} className="distributor-family-group-goal-detail__member-row">
                      <span className="min-w-0 truncate text-compact font-medium text-foreground">
                        {entry.displayName}
                      </span>
                      <span className="shrink-0 text-compact tabular-nums text-muted-foreground">
                        {formatAum(entry.amount)}
                        {investedTotal > 0 ? (
                          <span className="text-caption"> · {sharePct}%</span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
