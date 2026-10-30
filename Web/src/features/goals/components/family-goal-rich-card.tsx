"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CheckCircle2, PauseCircle, Wallet } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GoalStatus } from "@/features/goals/api/goals-api";
import { FamilyGoalMemberAvatars } from "@/features/goals/components/family-goal-member-avatars";
import { FamilyGroupCircle } from "@/features/invest/components/mf-family-goal-link-picker";
import {
  goalRichCardSurfaceVarsFor,
  goalTemplateSlugForId,
  resolveFamilyGoalRichCardIllustrationUrl,
} from "@/features/goals/lib/goal-template-meta";
import { resolveFamilyGoalProgress } from "@/features/goals/lib/goal-family-goals";
import type { DashboardFamilyGoal } from "@/features/goals/lib/goal-family-goals";
import { formatGoalTargetMonthYear } from "@/features/goals/lib/goal-target-date-format";
import { useGoalTemplatesQuery } from "@/features/goals/hooks/use-goal-templates-query";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

import "@/features/goals/family-goal-card.css";

/** Fixed width — does not stretch with grid columns (wide enough for date tiles). */
export const FAMILY_GOAL_RICH_CARD_SCROLL_WIDTH_CLASS =
  "w-[32rem] max-w-full sm:w-[36rem] lg:w-[38rem]";
export const FAMILY_GOAL_RICH_CARD_GRID_WIDTH_CLASS = FAMILY_GOAL_RICH_CARD_SCROLL_WIDTH_CLASS;

function familyGoalShowsActiveStatus(status: GoalStatus) {
  return status === "active" || status === "achieved";
}

type FamilyGoalRichCardProps = {
  goal: DashboardFamilyGoal;
  layout?: "scroll" | "grid";
  className?: string;
};

export function FamilyGoalRichCard({ goal, layout = "scroll", className }: FamilyGoalRichCardProps) {
  const { templates } = useGoalTemplatesQuery();
  const slug = goalTemplateSlugForId(goal.template_id, templates);
  const template = templates.find((item) => item.id === goal.template_id);
  const GoalIcon = getGoalTemplateIcon(template?.icon_key);
  const illustrationUrl = resolveFamilyGoalRichCardIllustrationUrl(slug);
  const progress = resolveFamilyGoalProgress(goal);
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const targetFormatted = formatInr(goal.target_amount_inr, { compact: true });
  const targetDateLabel = formatGoalTargetMonthYear(goal.target_date);
  const savedAmountInr = goal.effective_current_amount_inr ?? goal.current_amount_inr;
  const savedFormatted = formatInr(savedAmountInr, { compact: true });
  const surfaceVars = goalRichCardSurfaceVarsFor(slug);
  const status = goal.status as GoalStatus;
  const statusLabel = copy.goals.status[status] ?? goal.status;
  const isActiveStatus = familyGoalShowsActiveStatus(status);
  const StatusMarkIcon = isActiveStatus ? CheckCircle2 : PauseCircle;
  const groupHref = buildFamilyGroupHref({ id: goal.family_group_id, title: goal.groupTitle });

  return (
    <div
      className={cn(
        "family-goal-card group relative block shrink-0",
        layout === "scroll"
          ? FAMILY_GOAL_RICH_CARD_SCROLL_WIDTH_CLASS
          : FAMILY_GOAL_RICH_CARD_GRID_WIDTH_CLASS,
        className,
      )}
    >
      <Link
        href={groupHref}
        className="family-goal-card__hit-area rounded-[1.25rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`${goal.groupTitle}, ${goal.title}, ${statusLabel}, ${targetFormatted}, ${clampedProgress.toFixed(0)}% progress`}
      />
      <article
        className="family-goal-card__surface"
        data-slug={slug}
        style={surfaceVars as CSSProperties}
      >
        <div className="family-goal-card__status-wrap">
          <Tooltip>
            <TooltipTrigger
              type="button"
              className={cn(
                "family-goal-card__status-mark",
                isActiveStatus
                  ? "family-goal-card__status-mark--active"
                  : "family-goal-card__status-mark--paused",
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

        <div className="family-goal-card__media" aria-hidden>
          {illustrationUrl ? (
            <Image
              src={illustrationUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 360px, 480px"
              className="family-goal-card__media-img"
              priority={false}
            />
          ) : (
            <div className="family-goal-card__media-fallback" />
          )}
          {goal.groupMembers.length > 0 ? (
            <FamilyGoalMemberAvatars
              members={goal.groupMembers}
              memberCount={goal.groupMemberCount}
            />
          ) : (
            <div className="family-goal-card__members" aria-hidden>
              <FamilyGroupCircle
                label={goal.groupTitle}
                avatarUrl={goal.groupAvatarUrl}
                opaque
                className="size-9 text-[10px]"
              />
            </div>
          )}
        </div>

        <div className="family-goal-card__main">
          <header className="family-goal-card__header">
            <span className="family-goal-card__goal-icon" aria-hidden>
              <GoalIcon className="size-4" strokeWidth={2.1} />
            </span>
            <FamilyGroupCircle
              label={goal.groupTitle}
              avatarUrl={goal.groupAvatarUrl}
              opaque
              className="size-10 shrink-0 text-xs font-bold"
            />
            <div className="family-goal-card__header-copy">
              <h3 className="family-goal-card__title">{goal.groupTitle}</h3>
            </div>
          </header>

          <div className="family-goal-card__target-block">
            <span className="family-goal-card__target-label">{copy.goals.richCardTargetPrefix}</span>
            <p className="family-goal-card__target-amount">{targetFormatted}</p>
          </div>

          <div
            className="family-goal-card__progress-wrap"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clampedProgress}
            aria-label={`${copy.goals.progressLabel}: ${clampedProgress.toFixed(0)}%`}
          >
            <div className="family-goal-card__progress-track">
              <div
                className="family-goal-card__progress-fill"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
            <span className="family-goal-card__progress-pct">{clampedProgress.toFixed(0)}%</span>
          </div>

          <div className="family-goal-card__tiles">
            <div className="family-goal-card__tile">
              <span className="family-goal-card__tile-icon" aria-hidden>
                <Wallet className="size-3.5" strokeWidth={2} />
              </span>
              <div className="family-goal-card__tile-copy">
                <p className="family-goal-card__tile-caption">{copy.goals.richCardSavedLabel}</p>
                <p className="family-goal-card__tile-value">{savedFormatted}</p>
              </div>
            </div>
            <div className="family-goal-card__tile">
              <span className="family-goal-card__tile-icon" aria-hidden>
                <CalendarDays className="size-3.5" strokeWidth={2} />
              </span>
              <div className="family-goal-card__tile-copy">
                <p className="family-goal-card__tile-caption">{copy.goals.targetDateLabel}</p>
                <p className="family-goal-card__tile-value">{targetDateLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
