"use client";

import type { ReactNode } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type KycStepHeroProps = {
  media: ReactNode;
  badge?: ReactNode;
  descriptionLines?: readonly string[];
  className?: string;
};

export function KycStepHero({
  media,
  badge,
  descriptionLines,
  className,
}: KycStepHeroProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4 px-1 py-2 text-center", className)}>
      {media}

      {badge ? <div>{badge}</div> : null}

      {descriptionLines && descriptionLines.length > 0 ? (
        <div className="max-w-sm space-y-1">
          {descriptionLines.map((line) => (
            <p key={line} className="text-caption leading-relaxed text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type KycStepHeroBadgeProps = {
  children: React.ReactNode;
  variant?: "info" | "neutral";
};

export function KycStepHeroBadge({ children, variant = "info" }: KycStepHeroBadgeProps) {
  return (
    <StatusBadge variant={variant} showIcon={false} className="h-6 px-2.5 text-[11px]">
      {children}
    </StatusBadge>
  );
}
