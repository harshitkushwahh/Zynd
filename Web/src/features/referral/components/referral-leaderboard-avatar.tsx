"use client";

import { ReferralUserAvatar } from "@/features/referral/components/referral-user-avatar";
import {
  getLeaderboardRankStyle,
  type ReferralLeaderboardEntry,
} from "@/features/referral/lib/referral-leaderboard-data";
import { cn } from "@/lib/utils";

type ReferralLeaderboardAvatarProps = {
  entry: Pick<ReferralLeaderboardEntry, "rank" | "name" | "isCurrentUser" | "profileImageUrl">;
  size?: "preview" | "row";
  className?: string;
};

export function ReferralLeaderboardAvatar({
  entry,
  size = "preview",
  className,
}: ReferralLeaderboardAvatarProps) {
  const rankStyle = getLeaderboardRankStyle(entry.rank);

  return (
    <div
      className={cn(
        "relative shrink-0",
        entry.rank === 1 && "z-30",
        entry.rank === 2 && "z-20",
        entry.rank === 3 && "z-10",
        className
      )}
    >
      <ReferralUserAvatar
        name={entry.name}
        imageUrl={entry.profileImageUrl}
        isCurrentUser={entry.isCurrentUser}
        className={cn(
          "ring-2 ring-offset-1 ring-offset-card",
          size === "row" ? "size-10 sm:size-11" : "size-9",
          rankStyle.ringClass
        )}
      />

      <span
        className={cn(
          "pointer-events-none absolute -bottom-1 left-1/2 flex size-4 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold leading-none",
          rankStyle.badgeClass
        )}
        aria-hidden
      >
        {entry.rank}
      </span>
    </div>
  );
}
