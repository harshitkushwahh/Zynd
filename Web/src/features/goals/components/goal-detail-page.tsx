"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Archive, Pencil } from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { FieldMessage } from "@/components/ui/ui-message";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import {
  archiveGoal,
  calculateGoal,
  updateGoal,
  type Goal,
  type GoalCalculatorResult,
  type GoalStatus,
  type UpdateGoalInput,
} from "@/features/goals/api/goals-api";
import { GoalCreateDialog } from "@/features/goals/components/goal-create-dialog";
import { GoalDetailMetaChips } from "@/features/goals/components/goal-detail-meta-chips";
import { GoalDetailPageSkeleton } from "@/features/goals/components/goal-detail-page-skeleton";
import { GoalsContentFade } from "@/features/goals/components/goals-page-loading-view";
import {
  GoalDetailPlanCard,
  GoalDetailProgressCard,
  GoalDetailTargetCard,
} from "@/features/goals/components/goal-detail-overview";
import { useGoalDetailQuery } from "@/features/goals/hooks/use-goal-detail-query";
import { GOAL_DEFAULT_RETURN_PCT, monthsUntil } from "@/features/goals/lib/goal-calculator";
import { GOALS_LIST_HREF } from "@/features/goals/lib/goal-navigation";
import { invalidateGoalsQueries } from "@/features/goals/lib/invalidate-goals-queries";
import { resolveGoalProgress } from "@/features/goals/lib/goal-summary";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { goalTemplateIconThemeFor } from "@/features/goals/lib/goal-template-meta";
import { formatInr } from "@/features/invest/lib/mf-format";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type GoalDetailPageProps = {
  goalId: string;
};

function GoalDetailBreadcrumb({ title }: { title: string }) {
  return (
    <DashboardBreadcrumb
      items={[
        { label: copy.goals.title, href: GOALS_LIST_HREF },
        { label: title },
      ]}
    />
  );
}

function isGoalActiveStatus(status: GoalStatus) {
  return status === "active";
}

function canToggleGoalActiveStatus(status: GoalStatus) {
  return status === "active" || status === "paused" || status === "draft";
}

export function GoalDetailPage({ goalId }: GoalDetailPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { goal, showSkeleton, errorMessage, isFetching, refetch } = useGoalDetailQuery(goalId);
  const [plan, setPlan] = useState<GoalCalculatorResult | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!goal) {
      setPlan(null);
      return;
    }

    let cancelled = false;
    setPlanLoading(true);
    void calculateGoal({
      target_amount_inr: goal.target_amount_inr,
      target_date: goal.target_date,
      existing_savings_inr: goal.existing_savings_inr,
      expected_return_pct: goal.expected_return_pct ?? GOAL_DEFAULT_RETURN_PCT,
    })
      .then((response) => {
        if (!cancelled) setPlan(response);
      })
      .catch(() => {
        if (!cancelled) setPlan(null);
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [goal]);

  function setCachedGoal(next: Goal) {
    queryClient.setQueryData(queryKeys.goals.detail(goalId), next);
    queryClient.setQueryData(
      queryKeys.goals.me(true),
      (current: { items: Goal[]; limit: number; active_count: number } | undefined) => {
        if (!current) return current;
        const items = current.items.some((item) => item.id === next.id)
          ? current.items.map((item) => (item.id === next.id ? next : item))
          : [next, ...current.items];
        return {
          ...current,
          items,
          active_count: items.filter((item) => item.status !== "archived").length,
        };
      },
    );
  }

  async function handleUpdateGoal(input: UpdateGoalInput) {
    if (!goal) return;
    setEditSubmitting(true);
    setEditError("");
    try {
      const updated = await updateGoal(goal.id, input);
      setCachedGoal(updated);
      setEditOpen(false);
      await invalidateGoalsQueries(queryClient);
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : "";
      setEditError(message || copy.goals.updateError);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleArchiveGoal() {
    if (!goal) return;
    setArchiving(true);
    try {
      await archiveGoal(goal.id);
      await invalidateGoalsQueries(queryClient);
      router.push(GOALS_LIST_HREF);
    } catch {
      setActionError(copy.goals.updateError);
      setArchiveOpen(false);
    } finally {
      setArchiving(false);
    }
  }

  async function handleToggleActive(checked: boolean) {
    if (!goal || !canToggleGoalActiveStatus(goal.status)) return;

    setStatusUpdating(true);
    setStatusError("");
    try {
      const updated = await updateGoal(goal.id, {
        status: checked ? "active" : "paused",
      });
      setCachedGoal(updated);
      await invalidateGoalsQueries(queryClient);
    } catch {
      setStatusError(copy.goals.detailStatusUpdateError);
    } finally {
      setStatusUpdating(false);
    }
  }

  if (showSkeleton) {
    return <GoalDetailPageSkeleton />;
  }

  if (errorMessage || actionError || !goal) {
    return (
      <div className="space-y-6">
        <GoalDetailBreadcrumb title={copy.goals.detailTitle} />
        <LoadErrorCard
          title={copy.goals.detailLoadFailedTitle}
          description={actionError ?? errorMessage ?? copy.goals.detailLoadError}
          retryLabel={copy.goals.retry}
          retryLoading={isFetching}
          onRetry={() => {
            setActionError(null);
            void refetch();
          }}
        />
      </div>
    );
  }

  const Icon = getGoalTemplateIcon(goal.template?.icon_key);
  const iconTheme = goalTemplateIconThemeFor(goal.template?.slug ?? "custom");
  const progress = resolveGoalProgress(goal);
  const savedAmount = goal.effective_current_amount_inr ?? goal.current_amount_inr;
  const remainingAmount = Math.max(goal.target_amount_inr - savedAmount, 0);
  const priorityLabel = copy.goals.priorityOptions[goal.priority as 1 | 2 | 3 | 4 | 5] ?? "Medium";
  const monthsLeft = monthsUntil(goal.target_date);
  const goalIsActive = isGoalActiveStatus(goal.status);
  const canToggleActive = canToggleGoalActiveStatus(goal.status);

  return (
    <GoalsContentFade className="space-y-6">
      <GoalDetailBreadcrumb title={goal.title} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border",
              iconTheme.iconBadgeClass,
            )}
          >
            <Icon className="size-5" strokeWidth={2.1} aria-hidden />
          </div>
          <div className="min-w-0">
            <PageTitle>{goal.title}</PageTitle>
            <p className="mt-2 max-w-2xl text-compact text-muted-foreground">
              {goal.template?.description ?? copy.goals.detailDescription}
            </p>
            <GoalDetailMetaChips goal={goal} priorityLabel={priorityLabel} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canToggleActive ? (
            <Switch
              checked={goalIsActive}
              disabled={statusUpdating || editSubmitting || archiving}
              onCheckedChange={(checked) => void handleToggleActive(checked)}
              aria-label={copy.goals.detailActiveLabel}
            />
          ) : null}
          {goal.status !== "archived" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={editSubmitting || statusUpdating || archiving}
                aria-label={copy.goals.editTitle}
                onClick={() => {
                  setEditError("");
                  setEditOpen(true);
                }}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={archiving || statusUpdating || editSubmitting}
                aria-label={copy.goals.archiveAction}
                onClick={() => setArchiveOpen(true)}
              >
                <Archive className="size-4" aria-hidden />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {statusError ? <FieldMessage message={statusError} className="mt-0" /> : null}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <GoalDetailProgressCard
            progress={progress}
            savedAmount={savedAmount}
            targetAmount={goal.target_amount_inr}
            remainingAmount={remainingAmount}
          />
          <GoalDetailTargetCard
            targetDateLabel={new Date(goal.target_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            monthsLeftLabel={copy.goals.monthsLabel(monthsLeft)}
            expectedReturnLabel={`${(goal.expected_return_pct ?? GOAL_DEFAULT_RETURN_PCT).toFixed(1)}%`}
          />
        </div>

        <div className="xl:col-span-2">
          <GoalDetailPlanCard plan={plan} loading={planLoading} />
        </div>
      </div>

      {goal.linked_product_name ? (
        <Card className="border border-border shadow-none ring-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{copy.goals.detailLinkedInvestmentLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-compact">
            <p className="font-medium text-foreground">{goal.linked_product_name}</p>
            {goal.linked_sip_monthly_inr != null ? (
              <p className="text-muted-foreground">
                {copy.goals.detailLinkedSipLabel}: {formatInr(goal.linked_sip_monthly_inr)}
              </p>
            ) : null}
            {goal.holdings_value_inr != null ? (
              <p className="text-muted-foreground">
                {copy.goals.detailHoldingsLabel}: {formatInr(goal.holdings_value_inr)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <GoalCreateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        goal={goal}
        onUpdate={handleUpdateGoal}
        submitting={editSubmitting}
        error={editError}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        variant="warning"
        title={copy.goals.archiveTitle}
        description={copy.goals.archiveDescription}
        confirmLabel={copy.goals.archiveConfirm}
        loading={archiving}
        onConfirm={() => void handleArchiveGoal()}
      />
    </GoalsContentFade>
  );
}
