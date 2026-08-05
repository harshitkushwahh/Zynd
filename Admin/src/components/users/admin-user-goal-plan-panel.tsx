"use client";

import { CalendarDays, Info, PiggyBank, Target, TrendingUp, Wallet } from "lucide-react";

import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminOverviewStatCell } from "@/components/ui/admin-overview-stat-cell";
import { AdminUserGoalPriorityBadge } from "@/components/users/admin-user-goal-priority-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminUserGoal } from "@/lib/admin-api";
import {
  getAdminGoalExpectedReturnHint,
  getAdminGoalPlanAssumptionNotice,
  goalHasLinkedInvestment,
} from "@/lib/admin-goal-plan-assumptions";
import {
  getAdminGoalTemplateIcon,
  getAdminGoalTemplateIconModifier,
} from "@/lib/admin-goal-template-ui";
import { formatCompactInr, formatInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type AdminUserGoalPlanPanelProps = {
  goal: AdminUserGoal;
  funding: {
    declared: number;
    contributed: number;
    remaining: number;
  };
  className?: string;
};

function formatPlanDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminUserGoalPlanPanel({ goal, funding, className }: AdminUserGoalPlanPanelProps) {
  const templateName = goal.template?.name ?? "Custom goal";
  const templateDescription = goal.template?.description ?? null;
  const Icon = getAdminGoalTemplateIcon(goal.template?.icon_key);
  const iconModifier = getAdminGoalTemplateIconModifier(goal.template?.slug, goal.template?.icon_key);
  const tag = goal.tag ?? templateName;
  const hasLinkedInvestment = goalHasLinkedInvestment(goal);
  const expectedReturnHint = getAdminGoalExpectedReturnHint(goal);
  const planAssumptionNotice = getAdminGoalPlanAssumptionNotice(goal);

  return (
    <Card className={cn("admin-user-goal-plan-panel ring-0 border-border", className)}>
      <CardContent className="admin-user-goal-plan-panel__content">
        <header className="admin-user-goal-plan-panel__header">
          <span
            className={cn(
              "admin-user-goal-plan-panel__icon",
              `admin-user-goal-plan-panel__icon--${iconModifier}`,
            )}
            aria-hidden
          >
            <Icon className="size-5" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="admin-user-goal-plan-panel__title-row">
              <h3 className="admin-user-goal-plan-panel__title">{templateName}</h3>
              {tag ? <span className="admin-family-group-goal-card__tag">{tag}</span> : null}
            </div>
            {templateDescription ? (
              <p className="admin-user-goal-plan-panel__description">{templateDescription}</p>
            ) : (
              <p className="admin-user-goal-plan-panel__description admin-user-goal-plan-panel__description--muted">
                No template description available for this goal.
              </p>
            )}
          </div>
        </header>

        <AdminMetricCardsGrid className="admin-user-goal-plan-panel__metrics">
          <AdminMetricCard
            accent
            icon={TrendingUp}
            label="Planning return"
            value={
              goal.expected_return_pct != null ? `${goal.expected_return_pct.toFixed(1)}%` : "—"
            }
            hint={expectedReturnHint}
            infoDescription="Annual return rate used for goal planning calculations such as required SIP and projected value."
            infoDetails={[
              "This is not calculated from mutual fund NAV, holdings, or live portfolio performance.",
              goal.template
                ? `The ${goal.template.name} template suggests ${goal.template.suggested_return_pct?.toFixed(1) ?? "—"}% by default.`
                : "Custom goals may store a user-chosen planning rate at creation.",
              hasLinkedInvestment
                ? "Linking or investing in a fund does not automatically change this rate."
                : "With no fund linked yet, this rate still comes from the goal plan only.",
            ]}
          />
          <AdminMetricCard
            icon={Target}
            label="Projected value"
            value={
              goal.projected_value_inr != null ? formatInr(goal.projected_value_inr) : "—"
            }
            hint="Planning estimate at target date"
            infoDescription="Estimated corpus at the target date based on the planning return, target amount, timeline, and current savings."
            infoDetails={[
              "Derived from the goal calculator—not from actual mutual fund returns.",
              "Updates when target amount, date, savings, or the stored planning return changes.",
            ]}
          />
          <AdminMetricCard
            icon={CalendarDays}
            label="Target date"
            value={formatPlanDate(goal.target_date)}
            hint="Goal completion date"
          />
          <AdminMetricCard
            icon={Wallet}
            label="Priority"
            value={<AdminUserGoalPriorityBadge priority={goal.priority} />}
            hint="Relative importance"
          />
        </AdminMetricCardsGrid>

        <div className="admin-overview-stat-grid admin-user-goal-plan-panel__stats">
          <AdminOverviewStatCell label="Target amount" value={formatCompactInr(goal.target_amount_inr)} />
          <AdminOverviewStatCell
            label="Declared savings"
            value={formatCompactInr(funding.declared)}
            tone={funding.declared > 0 ? "success" : "muted"}
          />
          <AdminOverviewStatCell
            label="Contributions"
            value={formatCompactInr(funding.contributed)}
            tone={funding.contributed > 0 ? "success" : "muted"}
          />
          <AdminOverviewStatCell
            label="Remaining"
            value={formatCompactInr(funding.remaining)}
            tone="warning"
            hint="To reach target"
          />
        </div>

        <div className="admin-user-goal-plan-panel__notice" role="note">
          <Info className="admin-user-goal-plan-panel__notice-icon size-4 shrink-0" aria-hidden />
          <p className="admin-user-goal-plan-panel__notice-copy">{planAssumptionNotice}</p>
        </div>

        {goal.template?.default_tenure_months ? (
          <p className="admin-user-goal-plan-panel__footnote">
            <PiggyBank className="size-3.5 shrink-0" aria-hidden />
            Suggested tenure: {goal.template.default_tenure_months} months
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
