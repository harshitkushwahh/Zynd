"use client";

import { useMemo } from "react";
import { Goal, Target, TrendingUp, Wallet } from "lucide-react";

import { AdminFamilyGroupGoalTile } from "@/components/users/admin-family-group-goal-tile";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminTableSkeleton } from "@/components/ui/admin-skeletons";
import { useAdminUserGoalsQuery, type AdminUserGoal } from "@/hooks/use-admin-user-goals-query";
import { clientIdToProfilePath } from "@/lib/admin-user-ref";
import { userGoalDetailHref } from "@/lib/admin-user-goal-navigation";
import { getErrorMessage } from "@/lib/errors";

type UserGoalsDetailSectionProps = {
  userRef: string;
};

function formatInr(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function summarizeGoals(goals: AdminUserGoal[]) {
  const active = goals.filter((goal) => goal.status === "active");
  const totalTargetAmount = goals.reduce((sum, goal) => sum + goal.target_amount_inr, 0);
  const totalInvestedAmount = goals.reduce(
    (sum, goal) => sum + (goal.effective_current_amount_inr ?? goal.current_amount_inr),
    0,
  );
  const progressPct =
    totalTargetAmount > 0
      ? Math.min(100, Math.round((totalInvestedAmount / totalTargetAmount) * 100))
      : 0;
  const remainingAmount = Math.max(0, totalTargetAmount - totalInvestedAmount);

  return {
    totalGoals: goals.length,
    activeGoals: active.length,
    totalTargetAmount,
    totalInvestedAmount,
    progressPct,
    remainingAmount,
  };
}

export function UserGoalsDetailSection({ userRef }: UserGoalsDetailSectionProps) {
  const { data, isPending, error: queryError } = useAdminUserGoalsQuery(userRef);
  const goals = data ?? [];
  const showSkeleton = isPending && !data;
  const error = queryError ? getErrorMessage(queryError, "Could not load goals for this user.") : "";
  const profilePath = clientIdToProfilePath(userRef);

  const summary = useMemo(() => summarizeGoals(goals), [goals]);

  if (showSkeleton) {
    return <AdminTableSkeleton columns={1} rows={4} minWidth="lg" />;
  }

  if (error) {
    return <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>;
  }

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-border px-6 py-empty-state-lg text-center">
        <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
          <Goal className="size-5" />
        </div>
        <p className="mt-3 text-compact font-medium text-foreground">No goals yet</p>
        <p className="mt-1 max-w-sm text-caption text-muted-foreground">
          This user has not created any personal goals. Goal calculator plans will appear here once
          they set a target.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminMetricCardsGrid>
        <AdminMetricCard
          label="Total goals"
          icon={Target}
          tone="info"
          value={String(summary.totalGoals)}
          hint={`${formatInr(summary.totalTargetAmount)} target amount`}
        />
        <AdminMetricCard
          label="Active goals"
          icon={TrendingUp}
          tone="success"
          value={String(summary.activeGoals)}
          hint={`${formatInr(summary.totalInvestedAmount)} invested`}
        />
        <AdminMetricCard
          label="Overall progress"
          icon={Goal}
          tone={summary.progressPct >= 50 ? "success" : "muted"}
          value={`${summary.progressPct}%`}
          hint="Across all personal goals"
        />
        <AdminMetricCard
          label="Remaining to target"
          icon={Wallet}
          tone="warning"
          value={formatInr(summary.remainingAmount)}
          hint="Left to reach all targets"
        />
      </AdminMetricCardsGrid>

      <section className="admin-user-goals-section space-y-4">
        <h2 className="admin-user-family-group-detail__section-title">Goals</h2>
        <div className="admin-user-family-group-detail__goals-grid">
          {goals.map((goal) => (
            <AdminFamilyGroupGoalTile
              key={goal.id}
              goal={goal}
              href={userGoalDetailHref(profilePath, goal.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
