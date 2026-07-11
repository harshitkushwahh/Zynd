"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

import type { ReferralLeaderboardEntry } from "@/features/referral/lib/referral-leaderboard-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ReferralLeaderboardAvatar } from "@/features/referral/components/referral-leaderboard-avatar";
import { ReferralLeaderboardEmptyState } from "@/features/referral/components/referral-leaderboard-empty-state";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralLeaderboardPreviewCardProps = {
  entries: ReferralLeaderboardEntry[];
  totalParticipants: number;
};

export function ReferralLeaderboardPreviewCard({
  entries,
  totalParticipants,
}: ReferralLeaderboardPreviewCardProps) {
  const previewEntries = entries.slice(0, 3);
  const remainingCount = Math.max(0, totalParticipants - previewEntries.length);
  const moreCountLabel =
    remainingCount > 0 ? `+${remainingCount}` : copy.referral.leaderboardMoreCount;

  return (
    <section
      className={cn(
        "w-full border border-border bg-card p-3 sm:p-4",
        REFERRAL_CARD_RADIUS_CLASS
      )}
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-warning" strokeWidth={2.25} />
          <p className="text-compact font-semibold text-foreground">{copy.referral.leaderboardTitle}</p>
        </div>

        {previewEntries.length === 0 ? (
          <ReferralLeaderboardEmptyState variant="compact" />
        ) : (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <div className="flex items-center pl-1">
              {previewEntries.map((entry, index) => (
                <ReferralLeaderboardAvatar
                  key={entry.rank}
                  entry={entry}
                  className={index === 0 ? "ml-0" : "-ml-2"}
                />
              ))}

              {remainingCount > 0 ? (
                <Avatar className="relative z-0 -ml-2 size-9 shrink-0 ring-2 ring-muted-foreground/20 ring-offset-1 ring-offset-card after:hidden">
                  <AvatarFallback className="bg-muted text-caption font-semibold text-foreground">
                    {moreCountLabel}
                  </AvatarFallback>
                </Avatar>
              ) : null}
            </div>

            <p className="text-caption text-muted-foreground/55">{copy.referral.leaderboardMoreHint}</p>
          </div>
        )}

        <Link
          href="/dashboard/referral/leaderboard"
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "ml-auto shrink-0 w-fit")}
        >
          {copy.referral.leaderboardViewAll}
          <ArrowRight className="size-3.5" strokeWidth={2.25} />
        </Link>
      </div>
    </section>
  );
}
