"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Plus } from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageHeader } from "@/components/ui/page-header";
import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import { Button } from "@/components/ui/button";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { type Goal, type GoalTemplate } from "@/features/goals/api/goals-api";
import { GoalCustomCreateDialog } from "@/features/goals/components/goal-custom-create-dialog";
import { FamilyGoalProgressCard } from "@/features/goals/components/family-goal-progress-card";
import { GoalProgressCard } from "@/features/goals/components/goal-progress-card";
import { GoalsHowItWorksCard } from "@/features/goals/components/goals-how-it-works-card";
import { GoalTemplateJourneyDialog } from "@/features/goals/components/goal-template-journey-dialog";
import { GoalTemplateStrip } from "@/features/goals/components/goal-template-strip";
import { GoalsSummaryPanel } from "@/features/goals/components/goals-summary-panel";
import { GoalsArchivedDialog } from "@/features/goals/components/goals-archived-dialog";
import { GoalsLockedSectionEmptyState } from "@/features/goals/components/goals-locked-section-empty-state";
import { GoalsPageSkeleton } from "@/features/goals/components/goals-page-skeleton";
import type {
  GoalCalculatorSaveInput,
  GoalCustomSaveInput,
} from "@/features/goals/components/goal-calculator-panel";
import { useGoalsDashboardQuery } from "@/features/goals/hooks/use-goals-dashboard-query";
import { invalidateGoalsQueries } from "@/features/goals/lib/invalidate-goals-queries";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import { savePersonalOrFamilyGoal, type SaveGoalInput } from "@/features/goals/lib/save-goal";
import { prefetchAllGoalTemplateIllustrations } from "@/features/goals/lib/prefetch-goal-template-illustrations";
import {
  GOALS_FAMILY_LIST_HREF,
  GOALS_FAMILY_PREVIEW_LIMIT,
  GOALS_PERSONAL_LIST_HREF,
  GOALS_PERSONAL_PREVIEW_LIMIT,
} from "@/features/goals/lib/goal-navigation";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

const goalsRoute = DASHBOARD_ROUTES.find((route) => route.id === "goals")!;
const GoalsIcon = goalsRoute.icon;

function GoalsBreadcrumb() {
  return <DashboardBreadcrumb items={[{ label: copy.goals.title }]} />;
}

export function GoalsPage() {
  const queryClient = useQueryClient();
  const {
    goals,
    familyGoals,
    templates,
    showSkeleton,
    hasResolved,
    errorMessage,
    isFetching,
    refetch,
    refetchFamilyGoals,
  } = useGoalsDashboardQuery();

  const [journeyTemplate, setJourneyTemplate] = useState<GoalTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [saveTemplateError, setSaveTemplateError] = useState("");

  useEffect(() => {
    if (templates.length === 0) return;
    prefetchAllGoalTemplateIllustrations();
  }, [templates.length]);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status !== "archived"),
    [goals],
  );

  const archivedGoals = useMemo(
    () => goals.filter((goal) => goal.status === "archived"),
    [goals],
  );

  const previewPersonalGoals = useMemo(
    () => activeGoals.slice(0, GOALS_PERSONAL_PREVIEW_LIMIT),
    [activeGoals],
  );

  const previewFamilyGoals = useMemo(
    () => familyGoals.slice(0, GOALS_FAMILY_PREVIEW_LIMIT),
    [familyGoals],
  );

  function patchMyGoals(updater: (current: Goal[]) => Goal[]) {
    queryClient.setQueryData(queryKeys.goals.me(true), (current: { items: Goal[]; limit: number; active_count: number } | undefined) => {
      const items = updater(current?.items ?? []);
      return {
        items,
        limit: current?.limit ?? 0,
        active_count: items.filter((goal) => goal.status !== "archived").length,
      };
    });
  }

  async function handleCreateGoal(input: SaveGoalInput) {
    setSubmitting(true);
    setCreateError("");
    try {
      const result = await savePersonalOrFamilyGoal(input);
      if (result.kind === "personal") {
        patchMyGoals((current) => [result.goal, ...current.filter((goal) => goal.id !== result.goal.id)]);
      } else {
        await invalidateGoalsQueries(queryClient);
        await invalidateFamilyQueries(queryClient, result.familyGroupId);
        await refetchFamilyGoals();
      }
      setCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : "";
      setCreateError(message || copy.goals.createError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateCustomGoal(input: GoalCustomSaveInput) {
    await handleCreateGoal({
      title: input.title,
      target_amount_inr: input.target_amount_inr,
      target_date: input.target_date,
      existing_savings_inr: input.existing_savings_inr,
      expected_return_pct: input.expected_return_pct,
      priority: input.priority,
      tag: input.tag,
      family_group_id: input.family_group_id,
    });
  }

  async function handleSaveTemplateGoal(input: GoalCalculatorSaveInput) {
    if (!journeyTemplate) return;
    setSavingTemplate(true);
    setSaveTemplateError("");
    try {
      const result = await savePersonalOrFamilyGoal({
        title: journeyTemplate.name,
        template_id: journeyTemplate.id,
        target_amount_inr: input.target_amount_inr,
        target_date: input.target_date,
        existing_savings_inr: input.existing_savings_inr,
        expected_return_pct: input.expected_return_pct,
        priority: input.priority,
        tag: input.tag,
        family_group_id: input.family_group_id,
      });
      if (result.kind === "personal") {
        patchMyGoals((current) => [result.goal, ...current.filter((goal) => goal.id !== result.goal.id)]);
      } else {
        await invalidateGoalsQueries(queryClient);
        await invalidateFamilyQueries(queryClient, result.familyGroupId);
        await refetchFamilyGoals();
      }
      setJourneyTemplate(null);
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : "";
      setSaveTemplateError(message || copy.goals.createError);
    } finally {
      setSavingTemplate(false);
    }
  }

  function handleOpenTemplateJourney(template: GoalTemplate) {
    setSaveTemplateError("");
    setJourneyTemplate(template);
  }

  function handleJourneyOpenChange(open: boolean) {
    if (!open) {
      setJourneyTemplate(null);
      setSaveTemplateError("");
    }
  }

  return (
    <div className="space-y-6">
      <GoalsBreadcrumb />
      <FundEligibilityBanner />

      <PageHeader
        icon={GoalsIcon}
        title={copy.goals.title}
        loading={showSkeleton}
        action={
          hasResolved && !errorMessage ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={copy.goals.viewArchivedGoals}
                onClick={() => setArchivedOpen(true)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-zynd-low transition-colors hover:border-primary/25 hover:bg-muted/30 hover:text-foreground"
              >
                <Archive className="size-4" strokeWidth={2} />
              </button>
              <Button onClick={() => setCreateOpen(true)} className="shrink-0">
                <Plus className="size-4" aria-hidden />
                {copy.goals.createAction}
              </Button>
            </div>
          ) : null
        }
      />

      {showSkeleton ? <GoalsPageSkeleton /> : null}

      {!showSkeleton && errorMessage ? (
        <DashboardContentFade>
          <LoadErrorCard
            title={copy.goals.loadFailedTitle}
            description={errorMessage}
            retryLabel={copy.goals.retry}
            retryLoading={isFetching}
            onRetry={() => void refetch()}
          />
        </DashboardContentFade>
      ) : null}

      {hasResolved && !errorMessage ? (
        <DashboardContentFade>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
            <div className="min-w-0 space-y-8">
              <section>
                <GoalTemplateStrip templates={templates} onSelect={handleOpenTemplateJourney} />
              </section>

              <section className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{copy.goals.yourGoalsTitle}</h2>
                  </div>
                  <Button
                    variant="muted"
                    size="sm"
                    className="shrink-0"
                    nativeButton={false}
                    render={<Link href={GOALS_PERSONAL_LIST_HREF} prefetch />}
                  >
                    {copy.goals.viewAllPersonalGoals}
                  </Button>
                </div>

                {activeGoals.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {previewPersonalGoals.map((goal) => (
                      <GoalProgressCard key={goal.id} goal={goal} />
                    ))}
                  </div>
                ) : (
                  <GoalsLockedSectionEmptyState variant="personal" />
                )}
              </section>

              <section className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{copy.goals.familyGoalsTitle}</h2>
                  </div>
                  <Button
                    variant="muted"
                    size="sm"
                    className="shrink-0"
                    nativeButton={false}
                    render={<Link href={GOALS_FAMILY_LIST_HREF} prefetch />}
                  >
                    {copy.goals.viewAllFamilyGoals}
                  </Button>
                </div>

                {familyGoals.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {previewFamilyGoals.map((goal) => (
                      <FamilyGoalProgressCard key={`${goal.family_group_id}-${goal.id}`} goal={goal} />
                    ))}
                  </div>
                ) : (
                  <GoalsLockedSectionEmptyState variant="family" />
                )}
              </section>
            </div>

            <div className="flex flex-col gap-6 lg:sticky lg:top-6">
              <GoalsSummaryPanel personalGoals={activeGoals} familyGoals={familyGoals} />
              <GoalsHowItWorksCard />
            </div>
          </div>
        </DashboardContentFade>
      ) : null}

      <GoalTemplateJourneyDialog
        template={journeyTemplate}
        open={journeyTemplate != null}
        onOpenChange={handleJourneyOpenChange}
        onSave={handleSaveTemplateGoal}
        saving={savingTemplate}
        error={saveTemplateError}
      />

      <GoalCustomCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreateCustomGoal}
        saving={submitting}
        error={createError}
      />

      <GoalsArchivedDialog
        open={archivedOpen}
        onOpenChange={setArchivedOpen}
        initialItems={archivedGoals}
        goalsReady={hasResolved}
        onGoalRestored={(goal) => {
          patchMyGoals((current) => {
            const existing = current.find((item) => item.id === goal.id);
            return existing
              ? current.map((item) => (item.id === goal.id ? goal : item))
              : [goal, ...current];
          });
          void queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(goal.id) });
        }}
        onGoalDeleted={(goalId) => {
          patchMyGoals((current) => current.filter((goal) => goal.id !== goalId));
          queryClient.removeQueries({ queryKey: queryKeys.goals.detail(goalId) });
        }}
      />
    </div>
  );
}
