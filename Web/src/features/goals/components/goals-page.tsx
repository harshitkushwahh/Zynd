"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Target } from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import {
  archiveGoal,
  createGoal,
  fetchGoalTemplates,
  fetchMyGoals,
  type CreateGoalInput,
  type Goal,
  type GoalTemplate,
} from "@/features/goals/api/goals-api";
import { GoalCalculatorPanel } from "@/features/goals/components/goal-calculator-panel";
import { GoalCreateDialog } from "@/features/goals/components/goal-create-dialog";
import { GoalProgressCard } from "@/features/goals/components/goal-progress-card";
import { GoalsPageSkeleton } from "@/features/goals/components/goals-page-skeleton";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const goalsRoute = DASHBOARD_ROUTES.find((route) => route.id === "goals")!;
const GoalsIcon = goalsRoute.icon;

function GoalsBreadcrumb() {
  return <DashboardBreadcrumb items={[{ label: copy.goals.title }]} />;
}

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const mountedRef = useRef(true);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status !== "archived"),
    [goals],
  );
  const selectedGoal = useMemo(
    () => activeGoals.find((goal) => goal.id === selectedGoalId) ?? activeGoals[0] ?? null,
    [activeGoals, selectedGoalId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [goalsResponse, templatesResponse] = await Promise.all([
        fetchMyGoals(true),
        fetchGoalTemplates(),
      ]);
      if (!mountedRef.current) return;
      setGoals(goalsResponse.items);
      setTemplates(templatesResponse.items);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message.trim() : "";
      setError(message && message !== "Request failed" ? message : copy.goals.loadError);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  async function handleCreateGoal(input: CreateGoalInput) {
    setSubmitting(true);
    setCreateError("");
    try {
      const created = await createGoal(input);
      setGoals((current) => [created, ...current]);
      setSelectedGoalId(created.id);
      setCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : "";
      setCreateError(message || copy.goals.createError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchiveGoal(goalId: string) {
    setArchiving(true);
    try {
      const archived = await archiveGoal(goalId);
      setGoals((current) => current.map((goal) => (goal.id === goalId ? archived : goal)));
      if (selectedGoalId === goalId) {
        setSelectedGoalId(null);
      }
    } catch {
      setError(copy.goals.updateError);
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <GoalsBreadcrumb />
        <GoalsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <GoalsBreadcrumb />
        <LoadErrorCard
          title={copy.goals.loadFailedTitle}
          description={error}
          retryLabel={copy.goals.retry}
          onRetry={() => void loadData()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GoalsBreadcrumb />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          title={copy.goals.title}
          description={copy.goals.description}
          icon={GoalsIcon}
        />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {copy.goals.createAction}
        </Button>
      </div>

      {activeGoals.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="size-6" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">{copy.goals.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-compact text-muted-foreground">
            {copy.goals.emptyDescription}
          </p>
          <Button className="mt-5" onClick={() => setCreateOpen(true)}>
            {copy.goals.createAction}
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {activeGoals.map((goal) => (
              <GoalProgressCard
                key={goal.id}
                goal={goal}
                selected={selectedGoal?.id === goal.id}
                onSelect={(item) => setSelectedGoalId(item.id)}
              />
            ))}
          </div>

          <div className="space-y-4">
            <GoalCalculatorPanel
              templates={templates}
              selectedTemplateId={selectedGoal?.template_id}
              initialTargetAmount={selectedGoal?.target_amount_inr ?? 500_000}
              initialTargetDate={selectedGoal?.target_date}
              initialExistingSavings={selectedGoal?.existing_savings_inr ?? 0}
              initialExpectedReturn={selectedGoal?.expected_return_pct ?? 12}
            />

            {selectedGoal ? (
              <div className={cn("rounded-xl border p-4")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{selectedGoal.title}</p>
                    <p className="text-compact text-muted-foreground">
                      {copy.goals.status[selectedGoal.status]}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={archiving}
                    onClick={() => void handleArchiveGoal(selectedGoal.id)}
                  >
                    {copy.goals.archiveAction}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <GoalCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        templates={templates}
        onSubmit={handleCreateGoal}
        submitting={submitting}
        error={createError}
      />
    </div>
  );
}
