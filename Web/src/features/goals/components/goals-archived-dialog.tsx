"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Car,
  GraduationCap,
  Heart,
  Home,
  Plane,
  Sunset,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { FieldMessage } from "@/components/ui/ui-message";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  deleteGoalPermanently,
  fetchMyGoals,
  restoreGoal,
  type Goal,
} from "@/features/goals/api/goals-api";
import { invalidateGoalsQueries } from "@/features/goals/lib/invalidate-goals-queries";
import { formatInr } from "@/features/invest/lib/mf-format";
import { ApiError } from "@/lib/api-client";
import {
  GOAL_MAX_PERSONAL_ACTIVE,
} from "@/features/goals/lib/goal-limits";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  car: Car,
  plane: Plane,
  "graduation-cap": GraduationCap,
  heart: Heart,
  home: Home,
  sunset: Sunset,
  target: Target,
};

type GoalsArchivedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preloaded archived goals from the parent page to avoid first-open fetch jitter. */
  initialItems?: Goal[];
  /** When true, the parent goals list has finished loading and initialItems can be trusted. */
  goalsReady?: boolean;
  onGoalRestored?: (goal: Goal) => void;
  onGoalDeleted?: (goalId: string) => void;
};

function ArchivedGoalRowSkeleton() {
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-2.5 py-2">
      <Skeleton className="size-8 shrink-0 rounded-[var(--radius-control)]" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="flex shrink-0 gap-1">
        <Skeleton className="size-8 rounded-[var(--radius-control)]" />
        <Skeleton className="size-8 rounded-[var(--radius-control)]" />
      </div>
    </div>
  );
}

function ArchivedGoalsListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 2 }).map((_, index) => (
        <ArchivedGoalRowSkeleton key={index} />
      ))}
    </div>
  );
}

function formatArchivedWhen(value?: string | null) {
  if (!value) return "recently";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function resolveGoalActionError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === "goal_limit_reached") {
      return copy.goals.limitReached(GOAL_MAX_PERSONAL_ACTIVE);
    }
    return error.message || fallback;
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && message !== "Request failed") {
      return message;
    }
  }
  return fallback;
}

export function GoalsArchivedDialog({
  open,
  onOpenChange,
  initialItems = [],
  goalsReady = false,
  onGoalRestored,
  onGoalDeleted,
}: GoalsArchivedDialogProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actingGoalId, setActingGoalId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadArchived = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }
    setError("");
    try {
      const response = await fetchMyGoals(true);
      setItems(response.items.filter((goal) => goal.status === "archived"));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message.trim() : "";
      if (!silent) {
        setError(message && message !== "Request failed" ? message : copy.goals.loadError);
        setItems([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setHasResolved(true);
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    setActionError("");
    if (goalsReady) {
      setError("");
      setItems(initialItems.filter((goal) => goal.status === "archived"));
      setHasResolved(true);
      setLoading(false);
      return;
    }
    setHasResolved(false);
    setLoading(true);
  }, [goalsReady, initialItems, open]);

  useEffect(() => {
    if (!open) return;
    setActionError("");
    void loadArchived({ silent: goalsReady });
  }, [goalsReady, loadArchived, open]);

  const showSkeleton = loading && items.length === 0;

  async function handleRestore(goalId: string) {
    setActingGoalId(goalId);
    setActionError("");
    try {
      const restored = await restoreGoal(goalId);
      setItems((current) => current.filter((goal) => goal.id !== goalId));
      await invalidateGoalsQueries(queryClient);
      onGoalRestored?.(restored);
    } catch (restoreError) {
      setActionError(resolveGoalActionError(restoreError, copy.goals.unarchiveError));
    } finally {
      setActingGoalId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteGoalPermanently(deleteTarget.id);
      setItems((current) => current.filter((goal) => goal.id !== deleteTarget.id));
      await invalidateGoalsQueries(queryClient);
      onGoalDeleted?.(deleteTarget.id);
      setDeleteTarget(null);
    } catch (deleteError) {
      setActionError(resolveGoalActionError(deleteError, copy.goals.deleteError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <BrandDialog
        open={open}
        onOpenChange={onOpenChange}
        title={copy.goals.archivedTitle}
        maxWidth="md"
        className="max-w-md"
      >
        <div className="max-h-[min(18rem,50vh)] overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
          {showSkeleton ? (
            <ArchivedGoalsListSkeleton />
          ) : error ? (
            <LoadErrorCard
              title={copy.goals.loadFailedTitle}
              description={error}
              retryLabel={copy.goals.retry}
              onRetry={() => void loadArchived()}
            />
          ) : hasResolved && items.length === 0 ? (
            <div className="flex flex-col items-center px-3 py-5 text-center">
              <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Archive className="size-4" strokeWidth={2} />
              </div>
              <p className="mt-2.5 text-compact font-semibold text-foreground">
                {copy.goals.archivedEmptyTitle}
              </p>
              <p className="mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">
                {copy.goals.archivedEmptyDescription}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {actionError ? <FieldMessage message={actionError} className="mt-0" /> : null}
              <ul className="space-y-1.5">
                {items.map((goal) => {
                  const iconKey = goal.template?.icon_key ?? "target";
                  const Icon = TEMPLATE_ICONS[iconKey] ?? Target;
                  const acting = actingGoalId === goal.id;

                  return (
                    <li
                      key={goal.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-2.5 py-2",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary ring-1 ring-inset ring-primary/10">
                        <Icon className="size-3.5" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-caption font-semibold text-foreground">{goal.title}</p>
                          <StatusBadge variant="neutral" showIcon={false}>
                            {copy.goals.status.archived}
                          </StatusBadge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatInr(goal.target_amount_inr, { compact: true })} ·{" "}
                          {goal.progress_pct.toFixed(0)}% ·{" "}
                          {copy.goals.archivedOn(formatArchivedWhen(goal.updated_at))}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          disabled={Boolean(actingGoalId) || deleting}
                          aria-label={acting ? copy.goals.loading : copy.goals.unarchiveAction}
                          onClick={() => void handleRestore(goal.id)}
                        >
                          <ArchiveRestore className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          disabled={Boolean(actingGoalId) || deleting}
                          aria-label={copy.goals.deleteAction}
                          onClick={() => setDeleteTarget(goal)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </BrandDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
        variant="destructive"
        title={copy.goals.deleteTitle}
        description={
          deleteTarget
            ? `${copy.goals.deleteDescription} (${deleteTarget.title})`
            : copy.goals.deleteDescription
        }
        confirmLabel={copy.goals.deleteConfirm}
        onConfirm={() => void handleDelete()}
        loading={deleting}
      />
    </>
  );
}
