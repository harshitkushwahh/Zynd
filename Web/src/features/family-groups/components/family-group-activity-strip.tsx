"use client";

import Link from "next/link";
import { Crown } from "lucide-react";

import { LoadErrorCard } from "@/components/ui/load-error-card";
import { Button } from "@/components/ui/button";
import { type FamilyGroupActivityItem } from "@/features/family-groups/api/family-groups-api";
import { useFamilyGroupActivityQuery } from "@/features/family-groups/hooks/use-family-group-dashboard-queries";
import { FamilyGroupActivityEmptyState } from "@/features/family-groups/components/family-group-activity-empty-state";
import { buildFamilyGroupActivityHref } from "@/features/family-groups/lib/family-group-navigation";
import { formatRelativeActivityTime, familyMemberInitials, FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupActivityStripProps = {
  groupId: string;
  className?: string;
  layout?: "horizontal" | "vertical";
};

const DASHBOARD_ACTIVITY_PREVIEW_LIMIT = 3;

function ActivityCard({ item, stacked = false }: { item: FamilyGroupActivityItem; stacked?: boolean }) {
  const label = item.actor_display_name ?? copy.familyGroups.activity.unknownMember;

  return (
    <div
      className={cn(
        FAMILY_GROUP_CARD_RADIUS_CLASS,
        "border border-border/80 bg-card p-3 shadow-zynd-low",
        stacked ? "w-full" : "min-w-[15rem] max-w-[16rem] shrink-0",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
            {item.actor_profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.actor_profile_image_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-[10px] font-semibold">{familyMemberInitials(label)}</span>
            )}
          </div>
          {item.actor_role === "head" ? (
            <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-card">
              <Crown className="size-2" strokeWidth={2.25} />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-caption font-medium text-foreground">{label}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{item.message}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {formatRelativeActivityTime(item.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FamilyGroupActivityStrip({
  groupId,
  className,
  layout = "horizontal",
}: FamilyGroupActivityStripProps) {
  const { items, showSkeleton, errorMessage, refetch, isFetching } = useFamilyGroupActivityQuery(
    groupId,
    DASHBOARD_ACTIVITY_PREVIEW_LIMIT,
  );

  return (
    <section
      className={cn(
        FAMILY_GROUP_CARD_RADIUS_CLASS,
        "flex h-full flex-col border border-border bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-foreground">{copy.familyGroups.dashboard.activityTitle}</h3>
          <p className="mt-1 text-compact text-muted-foreground">{copy.familyGroups.dashboard.activitySubtitle}</p>
        </div>
        <Button
          variant="muted"
          size="sm"
          nativeButton={false}
          render={<Link href={buildFamilyGroupActivityHref(groupId)} />}
        >
          {copy.familyGroups.dashboard.viewAllActivity}
        </Button>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        {showSkeleton ? (
          <p className="text-compact text-muted-foreground">{copy.familyGroups.activity.loading}</p>
        ) : errorMessage ? (
          <LoadErrorCard
            title={copy.familyGroups.activity.loadFailedTitle}
            description={errorMessage}
            retryLabel={copy.familyGroups.errors.retry}
            retryLoading={isFetching}
            onRetry={() => void refetch()}
          />
        ) : items.length === 0 ? (
          <FamilyGroupActivityEmptyState compact className="min-h-0 flex-1" />
        ) : layout === "vertical" ? (
          <div className="space-y-3">
            {items.map((item) => (
              <ActivityCard key={item.id} item={item} stacked />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {items.map((item) => (
              <ActivityCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
