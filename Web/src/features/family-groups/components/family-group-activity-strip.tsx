"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Clock3, TrendingUp, UserPlus, UsersRound } from "lucide-react";

import { LoadErrorCard } from "@/components/ui/load-error-card";
import {
  fetchFamilyGroupActivity,
  type FamilyGroupActivityItem,
} from "@/features/family-groups/api/family-groups-api";
import { formatRelativeActivityTime } from "@/features/family-groups/lib/family-group-ui";
import { parseApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupActivityStripProps = {
  groupId: string;
  onViewAll?: () => void;
  className?: string;
};

function activityIcon(eventType: string) {
  if (eventType.includes("invite")) return UserPlus;
  if (eventType.includes("joined") || eventType.includes("member")) return UsersRound;
  if (eventType.includes("badge") || eventType.includes("role")) return TrendingUp;
  return Clock3;
}

function ActivityCard({ item }: { item: FamilyGroupActivityItem }) {
  const Icon = activityIcon(item.event_type);
  return (
    <div className="min-w-[15rem] max-w-[16rem] shrink-0 rounded-[var(--radius-medium)] border border-border/80 bg-card p-3 shadow-zynd-low">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-3 text-caption leading-snug text-foreground">{item.message}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {formatRelativeActivityTime(item.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FamilyGroupActivityStrip({ groupId, onViewAll, className }: FamilyGroupActivityStripProps) {
  const [items, setItems] = useState<FamilyGroupActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchFamilyGroupActivity(groupId, { limit: 8 });
      setItems(response.items);
    } catch (loadError) {
      setError(parseApiError(loadError).message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  return (
    <section className={cn("rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-zynd-low sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-foreground">{copy.familyGroups.dashboard.activityTitle}</h3>
          <p className="mt-1 text-compact text-muted-foreground">{copy.familyGroups.activity.title}</p>
        </div>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-compact font-medium text-primary transition hover:text-primary/80"
          >
            {copy.familyGroups.dashboard.viewAllActivity}
            <ArrowRight className="size-3.5" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-compact text-muted-foreground">{copy.familyGroups.activity.loading}</p>
        ) : error ? (
          <LoadErrorCard
            title={copy.familyGroups.activity.loadFailedTitle}
            description={error}
            retryLabel={copy.familyGroups.errors.retry}
            onRetry={() => void loadActivity()}
          />
        ) : items.length === 0 ? (
          <p className="text-compact text-muted-foreground">{copy.familyGroups.activity.empty}</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {items.slice(0, 4).map((item) => (
              <ActivityCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
