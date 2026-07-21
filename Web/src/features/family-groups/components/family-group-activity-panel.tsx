"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import {
  fetchFamilyGroupActivity,
  type FamilyGroupActivityItem,
} from "@/features/family-groups/api/family-groups-api";
import { parseApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";

type FamilyGroupActivityPanelProps = {
  groupId: string;
};

function formatActivityTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FamilyGroupActivityPanel({ groupId }: FamilyGroupActivityPanelProps) {
  const [items, setItems] = useState<FamilyGroupActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadActivity = useCallback(
    async (cursor?: string) => {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const response = await fetchFamilyGroupActivity(groupId, { cursor, limit: 20 });
        setItems((current) => (cursor ? [...current, ...response.items] : response.items));
        setNextCursor(response.next_cursor ?? null);
        setHasMore(response.has_more);
      } catch (loadError) {
        setError(parseApiError(loadError).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  if (loading) {
    return <p className="text-compact text-muted-foreground">{copy.familyGroups.activity.loading}</p>;
  }

  if (error) {
    return (
      <LoadErrorCard
        title={copy.familyGroups.activity.loadFailedTitle}
        description={error}
        retryLabel={copy.familyGroups.errors.retry}
        onRetry={() => void loadActivity()}
      />
    );
  }

  if (items.length === 0) {
    return <p className="text-compact text-muted-foreground">{copy.familyGroups.activity.empty}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex gap-3 rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2.5"
        >
          <div className="mt-0.5 text-muted-foreground">
            <Clock3 className="size-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-caption text-foreground">{item.message}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{formatActivityTime(item.created_at)}</p>
          </div>
        </div>
      ))}
      {hasMore && nextCursor ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loadingMore}
          onClick={() => void loadActivity(nextCursor)}
        >
          {loadingMore ? copy.familyGroups.activity.loadingMore : copy.familyGroups.activity.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
