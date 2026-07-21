"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";

import { PaginationPageMinimalCenter, Table, TableCard } from "@/components/core/table";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import {
  fetchFamilyGroupActivity,
  type FamilyGroupActivityItem,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupActivityEmptyState } from "@/features/family-groups/components/family-group-activity-empty-state";
import { FamilyGroupActivityTableSkeleton } from "@/features/family-groups/components/family-group-activity-table-skeleton";
import { formatFamilyGroupActivityTimestamp } from "@/features/family-groups/lib/family-group-activity-utils";
import { familyMemberInitials } from "@/features/family-groups/lib/family-group-ui";
import { paginateItems } from "@/features/family-groups/lib/family-group-table-pagination";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { copy } from "@/shared/config/copy";

type FamilyGroupActivityTableProps = {
  groupId: string;
};

function ActivityMemberCell({ item }: { item: FamilyGroupActivityItem }) {
  const label = item.actor_display_name ?? copy.familyGroups.activity.unknownMember;

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-border/60">
          {item.actor_profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.actor_profile_image_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-caption font-semibold text-primary">{familyMemberInitials(label)}</span>
          )}
        </div>
        {item.actor_role === "head" ? (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-card">
            <Crown className="size-2" strokeWidth={2.25} />
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-compact font-medium text-foreground">{label}</p>
      </div>
    </div>
  );
}

export function FamilyGroupActivityTable({ groupId }: FamilyGroupActivityTableProps) {
  const [items, setItems] = useState<FamilyGroupActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    setPage(1);
    try {
      const allItems: FamilyGroupActivityItem[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await fetchFamilyGroupActivity(groupId, { cursor, limit: 50 });
        allItems.push(...response.items);
        cursor = response.next_cursor ?? undefined;
        hasMore = response.has_more;
      }

      setItems(allItems);
    } catch (loadError) {
      setError(resolveFamilyGroupApiError(loadError, copy.familyGroups.activity.loadFailedTitle));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const pagination = useMemo(() => paginateItems(items, page), [items, page]);

  if (loading) {
    return <FamilyGroupActivityTableSkeleton />;
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
    return <FamilyGroupActivityEmptyState />;
  }

  return (
    <div className="space-y-4">
      <TableCard.Root>
        <Table aria-label={copy.familyGroups.activity.pageTitle}>
          <Table.Header>
            <Table.Head id="member" label={copy.familyGroups.activity.tableMember} isRowHeader />
            <Table.Head id="activity" label={copy.familyGroups.activity.tableActivity} />
            <Table.Head id="when" label={copy.familyGroups.activity.tableWhen} />
          </Table.Header>
          <Table.Body items={pagination.pageItems}>
            {(item) => (
              <Table.Row id={item.id}>
                <Table.Cell>
                  <ActivityMemberCell item={item} />
                </Table.Cell>
                <Table.Cell>
                  <p className="max-w-xl text-compact leading-relaxed text-foreground">{item.message}</p>
                </Table.Cell>
                <Table.Cell>
                  <p className="whitespace-nowrap text-caption text-muted-foreground">
                    {formatFamilyGroupActivityTimestamp(item.created_at)}
                  </p>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
        {items.length > 0 ? (
          <PaginationPageMinimalCenter
            page={pagination.page}
            total={pagination.totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </TableCard.Root>
    </div>
  );
}
