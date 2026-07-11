"use client";

import Image from "next/image";
import { Lock } from "lucide-react";

import { ReferralUserAvatar } from "@/features/referral/components/referral-user-avatar";
import { ReferralLeaderboardEmptyState } from "@/features/referral/components/referral-leaderboard-empty-state";
import { formatReferralInr } from "@/features/referral/lib/referral-display";
import {
  buildPodiumSlots,
  getLeaderboardRankStyle,
  REFERRAL_PODIUM_ASSETS,
  type ReferralLeaderboardEntry,
  type ReferralLeaderboardPodiumSlot,
} from "@/features/referral/lib/referral-leaderboard-data";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralLeaderboardPodiumProps = {
  entries: ReferralLeaderboardEntry[];
};

function PodiumCardContent({
  entry,
  isFirst,
}: {
  entry: ReferralLeaderboardEntry;
  isFirst: boolean;
}) {
  const style = getLeaderboardRankStyle(entry.rank);
  const assets = REFERRAL_PODIUM_ASSETS[entry.rank as 1 | 2 | 3];

  return (
    <>
      <Image
        src={assets.badge}
        alt={assets.badgeAlt}
        width={40}
        height={48}
        className="absolute left-3 top-3 z-20 h-10 w-auto object-contain"
      />

      <div className="relative z-10 flex w-full flex-1 flex-col items-center">
        <ReferralUserAvatar
          name={entry.name}
          imageUrl={entry.profileImageUrl}
          isCurrentUser={entry.isCurrentUser}
          className={cn(
            "ring-2 ring-offset-2 ring-offset-background",
            isFirst ? "size-20 sm:size-[5.5rem]" : "size-16 sm:size-[4.5rem]",
            style.ringClass
          )}
          fallbackClassName="sm:text-body"
        />

        <h3 className="mt-3 max-w-full truncate text-compact font-semibold text-foreground sm:text-body">
          {entry.name}
        </h3>
        <p className="mt-1 text-caption text-muted-foreground">
          {copy.referral.leaderboardReferralsCountShort.replace(
            "{count}",
            String(entry.referralCount)
          )}
        </p>

        <div className="relative z-10 mt-auto flex w-full items-end justify-center gap-0.5 pt-5 pb-1 sm:gap-1">
          <Image
            src={assets.laurelLeft}
            alt=""
            width={52}
            height={52}
            className="h-11 w-auto shrink-0 object-contain opacity-90 sm:h-12"
            aria-hidden
          />
          <p
            className={cn(
              "min-w-0 shrink px-0.5 text-h4 font-bold tabular-nums tracking-tight sm:text-[1.35rem]",
              style.earningsClass
            )}
          >
            {formatReferralInr(entry.earningsInr)}
          </p>
          <Image
            src={assets.laurelRight}
            alt=""
            width={52}
            height={52}
            className="h-11 w-auto shrink-0 object-contain opacity-90 sm:h-12"
            aria-hidden
          />
        </div>
      </div>
    </>
  );
}

function PodiumCard({ entry }: { entry: ReferralLeaderboardEntry }) {
  const style = getLeaderboardRankStyle(entry.rank);
  const isFirst = entry.rank === 1;

  return (
    <article
      className={cn(
        "relative isolate flex flex-col items-center overflow-hidden px-4 pb-7 pt-10 text-center backdrop-blur-[var(--blur-sm)]",
        "[mask-image:linear-gradient(to_bottom,black_0%,black_82%,transparent_100%)]",
        "[-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_82%,transparent_100%)]",
        REFERRAL_CARD_RADIUS_CLASS,
        style.podiumSurfaceClass,
        isFirst ? "min-h-[280px] md:-mt-3 md:min-h-[300px] md:pb-8 md:pt-11" : "min-h-[252px] md:min-h-[268px] md:pb-7"
      )}
    >
      <div
        className={cn("pointer-events-none absolute inset-0", style.podiumGradientClass)}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[34%] bg-gradient-to-t from-background from-[22%] via-background/45 via-[50%] to-transparent"
        aria-hidden
      />

      <PodiumCardContent entry={entry} isFirst={isFirst} />
    </article>
  );
}

function LockedPodiumCard({
  rank,
  placeholder,
}: {
  rank: 2 | 3;
  placeholder: ReferralLeaderboardEntry;
}) {
  const style = getLeaderboardRankStyle(rank);
  const isFirst = false;

  return (
    <article
      className={cn(
        "relative isolate flex flex-col items-center overflow-hidden px-4 pb-7 pt-10 text-center backdrop-blur-[var(--blur-sm)]",
        "[mask-image:linear-gradient(to_bottom,black_0%,black_82%,transparent_100%)]",
        "[-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_82%,transparent_100%)]",
        REFERRAL_CARD_RADIUS_CLASS,
        style.podiumSurfaceClass,
        "min-h-[252px] md:min-h-[268px] md:pb-7"
      )}
    >
      <div
        className={cn("pointer-events-none absolute inset-0", style.podiumGradientClass)}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[34%] bg-gradient-to-t from-background from-[22%] via-background/45 via-[50%] to-transparent"
        aria-hidden
      />

      <div className="relative z-10 w-full select-none blur-[3px] opacity-55" aria-hidden>
        <PodiumCardContent entry={placeholder} isFirst={isFirst} />
      </div>

      <div className="absolute inset-0 z-20 flex items-center justify-center px-4">
        <div
          className={cn(
            "flex max-w-full items-center gap-3 border border-border bg-card/95 px-3.5 py-3 shadow-zynd-mid backdrop-blur-sm sm:px-4",
            REFERRAL_CARD_RADIUS_CLASS
          )}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Lock className="size-4 text-muted-foreground" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-compact font-semibold text-foreground">
              {copy.referral.leaderboardPodiumLockedTitle}
            </p>
            <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
              {copy.referral.leaderboardPodiumLockedSubtitle}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function PodiumSlot({ slot }: { slot: ReferralLeaderboardPodiumSlot }) {
  if (slot.kind === "entry") {
    return <PodiumCard entry={slot.entry} />;
  }
  return <LockedPodiumCard rank={slot.rank} placeholder={slot.placeholder} />;
}

export function ReferralLeaderboardPodium({ entries }: ReferralLeaderboardPodiumProps) {
  if (entries.length === 0) {
    return <ReferralLeaderboardEmptyState />;
  }

  const slots = buildPodiumSlots(entries);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end md:gap-4">
      {slots.map((slot) => (
        <PodiumSlot
          key={slot.kind === "entry" ? `entry-${slot.entry.rank}` : `locked-${slot.rank}`}
          slot={slot}
        />
      ))}
    </div>
  );
}
