"use client";

import { Gift, Loader2 } from "lucide-react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useDashboardRoute } from "@/features/dashboard/navigation/use-dashboard-route";
import { useReferralNavbarMeta } from "@/features/referral/hooks/use-referral-navbar-meta";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const NAVBAR_CARD_FADE_CLASS = "animate-in fade-in duration-200";

function formatRefereeCount(count: number) {
  return copy.referral.leaderboardReferralsCountShort.replace("{count}", String(count));
}

export function ReferralActiveCard({ pathname }: { pathname: string }) {
  const { pageMeta } = useDashboardRoute();
  const { isReferralsListPage, refereeCount, loading } = useReferralNavbarMeta(pathname);

  const showCount = isReferralsListPage && refereeCount !== null;
  const cardLabel = showCount ? formatRefereeCount(refereeCount) : pageMeta.title;
  const hoverDescription = showCount
    ? copy.referral.referralsPageDescription
    : pageMeta.description;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        closeDelay={120}
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-10 w-auto max-w-full items-center justify-center gap-1.5 rounded-[var(--radius-full)] px-3 outline-none",
              "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
            aria-label={cardLabel}
          />
        }
      >
        {loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin opacity-70" aria-hidden />
        ) : (
          <span key={cardLabel} className={cn(NAVBAR_CARD_FADE_CLASS, "inline-flex items-center gap-1.5")}>
            <Gift className="size-4 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
            <span className="whitespace-nowrap text-[13px] font-medium leading-none text-foreground">
              {cardLabel}
            </span>
          </span>
        )}
      </HoverCardTrigger>

      <HoverCardContent side="bottom" align="end" className="w-72">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
            <Gift className="size-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="line-clamp-2 text-compact font-semibold text-foreground">{cardLabel}</p>
            <p className="text-caption leading-relaxed text-muted-foreground">{hoverDescription}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
