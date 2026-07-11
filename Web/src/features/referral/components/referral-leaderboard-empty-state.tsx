"use client";

import { Trophy } from "lucide-react";

import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralLeaderboardEmptyStateProps = {
  variant?: "full" | "compact";
  className?: string;
};

export function ReferralLeaderboardEmptyState({
  variant = "full",
  className,
}: ReferralLeaderboardEmptyStateProps) {
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "flex items-start gap-3 border border-dashed border-border bg-muted/10 text-left",
        REFERRAL_CARD_RADIUS_CLASS,
        isCompact ? "px-3 py-4" : "px-5 py-8 sm:px-6 sm:py-10",
        className
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-warning/10",
          isCompact ? "size-10" : "size-12 sm:size-14"
        )}
      >
        <Trophy
          className={cn("text-warning", isCompact ? "size-5" : "size-6 sm:size-7")}
          strokeWidth={isCompact ? 2 : 1.75}
        />
      </div>

      <div className={cn("min-w-0 flex-1 space-y-1 pt-0.5", !isCompact && "sm:pt-1")}>
        <p
          className={cn(
            "font-semibold text-foreground",
            isCompact ? "text-caption" : "text-compact sm:text-body"
          )}
        >
          {copy.referral.leaderboardEmptyTitle}
        </p>
        <p
          className={cn(
            "text-muted-foreground leading-relaxed",
            isCompact ? "text-caption" : "text-compact"
          )}
        >
          {copy.referral.leaderboardEmptySubtitle}
        </p>
      </div>
    </div>
  );
}
