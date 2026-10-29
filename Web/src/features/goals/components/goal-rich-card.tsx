"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CheckCircle2, PauseCircle, Plus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { Goal, GoalStatus } from "@/features/goals/api/goals-api";
import { goalDetailHref } from "@/features/goals/lib/goal-navigation";
import { resolveGoalProgress } from "@/features/goals/lib/goal-summary";
import { formatGoalTargetMonthYear } from "@/features/goals/lib/goal-target-date-format";
import {
  goalRichCardSurfaceVarsFor,
  resolveGoalRichCardIllustrationUrl,
} from "@/features/goals/lib/goal-template-meta";
import { GoalRichCardMenu } from "@/features/goals/components/goal-rich-card-menu";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

import "@/features/goals/goal-rich-card.css";

export const GOAL_RICH_CARD_SCROLL_WIDTH_CLASS = "w-[28rem] sm:w-[30rem]";

function goalRichCardShowsActiveStatus(status: GoalStatus) {
  return status === "active" || status === "achieved";
}

type GoalRichCardProps = {
  goal: Goal;
  layout?: "scroll" | "grid";
  className?: string;
};

export function GoalRichCard({ goal, layout = "scroll", className }: GoalRichCardProps) {
  const slug = goal.template?.slug ?? "custom";
  const Icon = getGoalTemplateIcon(goal.template?.icon_key);
  const illustrationUrl = resolveGoalRichCardIllustrationUrl(slug, goal.template?.image_url);
  const progress = resolveGoalProgress(goal);
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const targetFormatted = formatInr(goal.target_amount_inr, { compact: true });
  const targetLine = `${copy.goals.richCardTargetPrefix} ${targetFormatted}`;
  const targetDateLabel = formatGoalTargetMonthYear(goal.target_date);
  const savedAmountInr = goal.effective_current_amount_inr ?? goal.current_amount_inr;
  const savedFormatted = formatInr(savedAmountInr, { compact: true });
  const surfaceVars = goalRichCardSurfaceVarsFor(slug);
  const isActiveStatus = goalRichCardShowsActiveStatus(goal.status);
  const StatusMarkIcon = isActiveStatus ? CheckCircle2 : PauseCircle;
  const statusLabel = copy.goals.status[goal.status];

  const detailHref = goalDetailHref(goal.id);

  return (
    <div
      className={cn(
        "goal-rich-card group relative block shrink-0",
        layout === "scroll" ? GOAL_RICH_CARD_SCROLL_WIDTH_CLASS : "w-full",
        className,
      )}
    >
      <Link
        href={detailHref}
        className="goal-rich-card__hit-area rounded-[1.35rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`${goal.title}, ${targetLine}, ${clampedProgress.toFixed(0)}% progress`}
      />
      <article
        className={cn("goal-rich-card__surface", illustrationUrl && "goal-rich-card__surface--photo")}
        data-slug={slug}
        style={surfaceVars as CSSProperties}
      >
        <div className="goal-rich-card__backdrop" aria-hidden>
          {illustrationUrl ? (
            <div className="goal-rich-card__hero-fill">
              <Image
                src={illustrationUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 320px, 420px"
                className="goal-rich-card__hero-img"
                priority={false}
              />
              <div className="goal-rich-card__hero-overlay" />
            </div>
          ) : (
            <div className="goal-rich-card__atmosphere" />
          )}
        </div>

        <div className="goal-rich-card__content">
          <div className="goal-rich-card__top-row">
            <div className="goal-rich-card__info-chip">
              <span className="goal-rich-card__icon" aria-hidden>
                <Icon className="size-4" strokeWidth={2.1} />
              </span>
              <div className="goal-rich-card__info-text">
                <p className="goal-rich-card__info-title">{goal.title}</p>
                <p className="goal-rich-card__info-target">{targetLine}</p>
              </div>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className={cn(
                    "goal-rich-card__status-mark",
                    isActiveStatus
                      ? "goal-rich-card__status-mark--active"
                      : "goal-rich-card__status-mark--paused",
                  )}
                  aria-label={statusLabel}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.preventDefault()}
                >
                  <StatusMarkIcon className="size-3.5" strokeWidth={2.25} aria-hidden />
                </TooltipTrigger>
                <TooltipContent side="top">{statusLabel}</TooltipContent>
              </Tooltip>
            </div>
            <GoalRichCardMenu goal={goal} className="goal-rich-card__menu-trigger" />
          </div>

          <div className="goal-rich-card__bottom-group">
            <div className="goal-rich-card__progress-row">
              <div
                className="goal-rich-card__progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clampedProgress}
                aria-label={copy.goals.progressLabel}
              >
                <div
                  className="goal-rich-card__progress-fill"
                  style={{ width: `${clampedProgress}%` }}
                />
              </div>
              <span className="goal-rich-card__progress-pct">{clampedProgress.toFixed(0)}%</span>
            </div>

            <footer className="goal-rich-card__footer">
              <div className="goal-rich-card__footer-chips">
                <div className="goal-rich-card__saved-chip">
                  <span className="goal-rich-card__meta-icon" aria-hidden>
                    <Wallet className="size-3.5" strokeWidth={2} />
                  </span>
                  <div className="goal-rich-card__meta-text">
                    <p className="goal-rich-card__meta-caption">{copy.goals.richCardSavedLabel}</p>
                    <p className="goal-rich-card__meta-value">{savedFormatted}</p>
                  </div>
                </div>
                <div className="goal-rich-card__date-chip">
                  <span className="goal-rich-card__meta-icon" aria-hidden>
                    <CalendarDays className="size-3.5" strokeWidth={2} />
                  </span>
                  <div className="goal-rich-card__meta-text">
                    <p className="goal-rich-card__meta-caption">{copy.goals.targetDateLabel}</p>
                    <p className="goal-rich-card__meta-value">{targetDateLabel}</p>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="goal-rich-card__cta pointer-events-auto relative z-[3]"
                nativeButton={false}
                render={<Link href="/dashboard/mutual-funds" prefetch />}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <Plus className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                {copy.goals.addMoneyAction}
              </Button>
            </footer>
          </div>
        </div>
      </article>
    </div>
  );
}
