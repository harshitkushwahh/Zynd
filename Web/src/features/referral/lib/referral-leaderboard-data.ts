export type ReferralLeaderboardEntry = {
  rank: number;
  name: string;
  referralCount: number;
  earningsInr: number;
  isCurrentUser?: boolean;
  profileImageUrl?: string | null;
};

export type ReferralLeaderboardPodiumSlot =
  | { kind: "entry"; entry: ReferralLeaderboardEntry }
  | { kind: "locked"; rank: 2 | 3; placeholder: ReferralLeaderboardEntry };

export const LEADERBOARD_LOCKED_PODIUM_PLACEHOLDERS: Record<2 | 3, ReferralLeaderboardEntry> = {
  2: {
    rank: 2,
    name: "A. Sharma",
    referralCount: 12,
    earningsInr: 8400,
  },
  3: {
    rank: 3,
    name: "R. Patel",
    referralCount: 8,
    earningsInr: 5200,
  },
};

export const REFERRAL_LEADERBOARD_TABLE_PAGE_SIZE = 5;

export const REFERRAL_PODIUM_ASSETS: Record<
  1 | 2 | 3,
  { laurelLeft: string; laurelRight: string; badge: string; badgeAlt: string }
> = {
  1: {
    laurelLeft: "/firstl.png",
    laurelRight: "/firstr.png",
    badge: "/firstb.png",
    badgeAlt: "1st place",
  },
  2: {
    laurelLeft: "/secondl.png",
    laurelRight: "/secondr.png",
    badge: "/seondb.png",
    badgeAlt: "2nd place",
  },
  3: {
    laurelLeft: "/thirdl.png",
    laurelRight: "/thirdr.png",
    badge: "/thirdb.png",
    badgeAlt: "3rd place",
  },
};

export function getLeaderboardRankStyle(rank: number) {
  if (rank === 1) {
    return {
      ringClass: "ring-warning/50",
      badgeClass: "bg-warning/80 text-warning-foreground",
      earningsClass: "text-warning",
      podiumSurfaceClass:
        "border border-warning/35 bg-gradient-to-b from-warning/[0.12] via-card/25 to-warning/[0.06] shadow-none",
      podiumGradientClass:
        "bg-[radial-gradient(ellipse_100%_80%_at_50%_100%,color-mix(in_srgb,var(--warning)_32%,transparent),transparent_58%)]",
    };
  }
  if (rank === 2) {
    return {
      ringClass: "ring-primary/45",
      badgeClass: "bg-primary text-primary-foreground",
      earningsClass: "text-primary",
      podiumSurfaceClass:
        "border-0 bg-gradient-to-b from-primary/[0.08] via-card/15 to-primary/[0.04] shadow-none",
      podiumGradientClass:
        "bg-[radial-gradient(ellipse_90%_70%_at_50%_100%,color-mix(in_srgb,var(--primary)_20%,transparent),transparent_66%)]",
    };
  }
  if (rank === 3) {
    return {
      ringClass: "ring-success/50",
      badgeClass: "bg-success text-success-foreground",
      earningsClass: "text-success",
      podiumSurfaceClass:
        "border-0 bg-gradient-to-b from-success/[0.08] via-card/15 to-success/[0.04] shadow-none",
      podiumGradientClass:
        "bg-[radial-gradient(ellipse_90%_70%_at_50%_100%,color-mix(in_srgb,var(--success)_20%,transparent),transparent_66%)]",
    };
  }
  return {
    ringClass: "ring-border/70",
    badgeClass: "bg-muted text-muted-foreground",
    earningsClass: "text-success",
    podiumSurfaceClass: "border border-border bg-card shadow-zynd-low",
    podiumGradientClass: "",
  };
}

export function getPodiumOrder(entries: ReferralLeaderboardEntry[]) {
  const byRank = Object.fromEntries(entries.map((entry) => [entry.rank, entry]));
  return [byRank[2], byRank[1], byRank[3]].filter(Boolean) as ReferralLeaderboardEntry[];
}

export function buildPodiumSlots(entries: ReferralLeaderboardEntry[]): ReferralLeaderboardPodiumSlot[] {
  const byRank = Object.fromEntries(entries.map((entry) => [entry.rank, entry]));
  const displayOrder: Array<1 | 2 | 3> = [2, 1, 3];

  return displayOrder.flatMap((rank) => {
    const entry = byRank[rank];
    if (entry) {
      return [{ kind: "entry" as const, entry }];
    }
    if (rank === 1) {
      return [];
    }
    return [
      {
        kind: "locked" as const,
        rank,
        placeholder: LEADERBOARD_LOCKED_PODIUM_PLACEHOLDERS[rank],
      },
    ];
  });
}

export function hasInsufficientLeaderboardTableData(totalEntries: number) {
  return totalEntries <= 3;
}

export function splitLeaderboardEntries(entries: ReferralLeaderboardEntry[]) {
  const topThree = entries.filter((entry) => entry.rank <= 3).sort((a, b) => a.rank - b.rank);
  const tableEntries = entries.filter((entry) => entry.rank > 3);
  return { topThree, tableEntries };
}
