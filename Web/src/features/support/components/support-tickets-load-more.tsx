"use client";

import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";

type SupportTicketsLoadMoreProps = {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  className?: string;
};

export function SupportTicketsLoadMore({
  hasMore,
  loading,
  onLoadMore,
  className,
}: SupportTicketsLoadMoreProps) {
  if (!hasMore) return null;

  return (
    <div className={className}>
      <Button
        type="button"
        variant="muted"
        className="w-full sm:w-auto"
        disabled={loading}
        onClick={onLoadMore}
      >
        {loading ? copy.support.loadingMoreTickets : copy.support.loadMoreTickets}
      </Button>
    </div>
  );
}
