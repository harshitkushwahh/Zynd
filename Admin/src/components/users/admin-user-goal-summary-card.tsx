"use client";

import Link from "next/link";
import { Receipt, Repeat, UsersRound } from "lucide-react";

import { AdminUserGoalHoldingsContributionPanel } from "@/components/users/admin-user-goal-holdings-contribution-panel";
import { Card, CardContent } from "@/components/ui/card";
import { AdminFamilyGroupRoleBadge } from "@/components/users/admin-family-group-role-badge";
import type { AdminUserGoal } from "@/lib/admin-api";
import type { AdminGoalHoldingContribution } from "@/lib/admin-goal-holding-contributions";
import {
  getAdminGoalTemplateIcon,
  getAdminGoalTemplateIconModifier,
} from "@/lib/admin-goal-template-ui";
import { formatInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type AdminUserGoalSummaryCardProps = {
  goal: AdminUserGoal;
  progressPct: number;
  holdingsContributions?: AdminGoalHoldingContribution[];
  sipMonthlyInr?: number;
  oneTimeOrdersInr?: number;
  familyGroupTitle?: string | null;
  familyGroupHref?: string | null;
  className?: string;
};

function formatTargetDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminUserGoalSummaryCard({
  goal,
  progressPct,
  holdingsContributions = [],
  sipMonthlyInr = 0,
  oneTimeOrdersInr = 0,
  familyGroupTitle,
  familyGroupHref,
  className,
}: AdminUserGoalSummaryCardProps) {
  const isFamilyGoal = Boolean(goal.family_group_id);
  const scopeLabel = isFamilyGoal ? "Family goal" : "Personal goal";
  const targetDateLabel = goal.target_date ? ` · Target by ${formatTargetDate(goal.target_date)}` : "";
  const templateTag = goal.tag ?? goal.template?.name ?? null;
  const Icon = getAdminGoalTemplateIcon(goal.template?.icon_key);
  const iconModifier = getAdminGoalTemplateIconModifier(goal.template?.slug, goal.template?.icon_key);

  return (
    <Card
      className={cn(
        "admin-user-goal-summary-card h-full overflow-hidden rounded-[var(--radius-5xl)] ring-0 border-border",
        className,
      )}
    >
      <CardContent className="admin-user-goal-summary-card__content px-4 py-4 sm:px-5 sm:py-5">
        <div className="admin-user-goal-summary-card__header">
          <span
            className={cn(
              "admin-user-goal-summary-card__icon",
              `admin-user-goal-summary-card__icon--${iconModifier}`,
            )}
            aria-hidden
          >
            <Icon className="size-5" strokeWidth={2.1} />
          </span>
          <div className="admin-user-goal-summary-card__header-copy">
            <div className="admin-user-goal-summary-card__title-row">
              <h1 className="admin-user-goal-summary-card__title">{goal.title}</h1>
              <AdminFamilyGroupRoleBadge label={goal.status} kind="status" />
              {templateTag ? (
                <span className="admin-family-group-goal-card__tag">{templateTag}</span>
              ) : null}
            </div>
            <p className="admin-user-goal-summary-card__meta">
              {scopeLabel}
              {targetDateLabel}
            </p>
          </div>
        </div>

        <AdminUserGoalHoldingsContributionPanel
          progressPct={progressPct}
          contributions={holdingsContributions}
        />

        <div className="admin-user-goal-summary-card__stats">
          <article className="admin-user-goal-summary-card__stat">
            <span className="admin-user-goal-summary-card__stat-icon" aria-hidden>
              <Repeat className="size-3.5" />
            </span>
            <div className="admin-user-goal-summary-card__stat-copy">
              <p className="admin-user-goal-summary-card__stat-label">Monthly SIP</p>
              <p className="admin-user-goal-summary-card__stat-value tabular-nums">
                {formatInr(sipMonthlyInr)}
              </p>
            </div>
          </article>

          <article className="admin-user-goal-summary-card__stat">
            <span className="admin-user-goal-summary-card__stat-icon" aria-hidden>
              <Receipt className="size-3.5" />
            </span>
            <div className="admin-user-goal-summary-card__stat-copy">
              <p className="admin-user-goal-summary-card__stat-label">One-time orders</p>
              <p className="admin-user-goal-summary-card__stat-value tabular-nums">
                {formatInr(oneTimeOrdersInr)}
              </p>
            </div>
          </article>

          <article className="admin-user-goal-summary-card__stat">
            <span className="admin-user-goal-summary-card__stat-icon" aria-hidden>
              <UsersRound className="size-3.5" />
            </span>
            <div className="admin-user-goal-summary-card__stat-copy">
              <p className="admin-user-goal-summary-card__stat-label">Family group</p>
              {isFamilyGoal ? (
                <p className="admin-user-goal-summary-card__stat-value truncate">
                  {familyGroupHref ? (
                    <Link href={familyGroupHref} className="hover:text-primary">
                      {familyGroupTitle ?? "Linked"}
                    </Link>
                  ) : (
                    familyGroupTitle ?? "Linked"
                  )}
                </p>
              ) : (
                <p className="admin-user-goal-summary-card__stat-value admin-user-goal-summary-card__stat-value--muted">
                  Not linked
                </p>
              )}
            </div>
          </article>
        </div>
      </CardContent>
    </Card>
  );
}
