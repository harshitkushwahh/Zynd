"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

import { GoalTemplateIllustrationImage } from "@/features/goals/components/goal-template-illustration-image";
import { resolveGoalTemplateIllustrationUrl } from "@/features/goals/lib/goal-template-meta";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { cn } from "@/lib/utils";

import "@/features/goals/goal-template-visual-card.css";

export type GoalTemplateVisualCardProps = {
  slug: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  iconKey?: string | null;
  variant?: "strip" | "dialog";
  interactive?: boolean;
  onActivate?: () => void;
  onPointerEnter?: () => void;
  onFocus?: () => void;
  className?: string;
};

export function GoalTemplateVisualCard({
  slug,
  name,
  description,
  imageUrl,
  iconKey,
  variant = "strip",
  interactive = false,
  onActivate,
  onPointerEnter,
  onFocus,
  className,
}: GoalTemplateVisualCardProps) {
  const illustrationUrl = resolveGoalTemplateIllustrationUrl(slug, imageUrl);
  const FallbackIcon = getGoalTemplateIcon(iconKey) as LucideIcon;
  const isDialog = variant === "dialog";

  const content = (
    <>
      <div className="goal-template-visual-card__media" data-slug={slug}>
        {illustrationUrl ? (
          <>
            <div className="goal-template-visual-card__image">
              <GoalTemplateIllustrationImage
                src={illustrationUrl}
                priority={isDialog}
                className="object-cover object-center"
              />
            </div>
            <div className="goal-template-visual-card__image-fade" aria-hidden />
          </>
        ) : (
          <div className="goal-template-visual-card__fallback" aria-hidden>
            <FallbackIcon className="size-10" strokeWidth={1.75} />
          </div>
        )}
      </div>

      <div className="goal-template-visual-card__body">
        <p className="goal-template-visual-card__title">{name}</p>
        {description ? (
          <p className="goal-template-visual-card__desc">{description}</p>
        ) : null}
        {interactive ? (
          <span className="goal-template-visual-card__chevron" aria-hidden>
            <ChevronRight className="size-[1.125rem]" strokeWidth={2.5} />
          </span>
        ) : null}
      </div>
    </>
  );

  const cardClass = cn(
    "goal-template-visual-card",
    isDialog && "goal-template-visual-card--dialog",
    className,
  );

  if (interactive && onActivate) {
    return (
      <button
        type="button"
        className={cardClass}
        onClick={onActivate}
        onMouseEnter={onPointerEnter}
        onFocus={onFocus}
      >
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}
