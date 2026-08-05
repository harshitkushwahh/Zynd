"use client";

import { Table, TableCard } from "@/components/core/table/table";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/shared/config/copy";

type FamilyGroupActivityTableSkeletonProps = {
  rows?: number;
};

export function FamilyGroupActivityTableSkeleton({ rows = 8 }: FamilyGroupActivityTableSkeletonProps) {
  const skeletonRows = Array.from({ length: rows }, (_, index) => ({ id: `activity-skeleton-${index}` }));

  return (
    <div className="space-y-4" aria-hidden="true">
      <TableCard.Root>
        <Table aria-label={copy.familyGroups.activity.pageTitle}>
          <Table.Header>
            <Table.Head id="member" label={copy.familyGroups.activity.tableMember} isRowHeader />
            <Table.Head id="activity" label={copy.familyGroups.activity.tableActivity} />
            <Table.Head id="when" label={copy.familyGroups.activity.tableWhen} />
          </Table.Header>
          <Table.Body items={skeletonRows}>
            {(row) => (
              <Table.Row id={row.id}>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Skeleton className="h-4 w-full max-w-md" />
                </Table.Cell>
                <Table.Cell>
                  <Skeleton className="h-4 w-24" />
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </TableCard.Root>
    </div>
  );
}
