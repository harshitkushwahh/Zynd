"use client";

import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import { ReferralUserAvatar } from "@/features/referral/components/referral-user-avatar";
import { ReferralLeaderboardTableInsufficientState } from "@/features/referral/components/referral-leaderboard-table-insufficient-state";
import { PaginationPageMinimalCenter, Table, TableCard } from "@/components/core/table";
import { formatReferralInr } from "@/features/referral/lib/referral-display";
import {
  REFERRAL_LEADERBOARD_TABLE_PAGE_SIZE,
  type ReferralLeaderboardEntry,
} from "@/features/referral/lib/referral-leaderboard-data";
import { copy } from "@/shared/config/copy";

type ReferralLeaderboardTableProps = {
  entries: ReferralLeaderboardEntry[];
  insufficientData?: boolean;
};

function TableUserCell({ entry }: { entry: ReferralLeaderboardEntry }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ReferralUserAvatar
        name={entry.name}
        imageUrl={entry.profileImageUrl}
        isCurrentUser={entry.isCurrentUser}
        className="size-8"
        fallbackClassName="text-[10px]"
      />
      <span className="truncate font-medium text-foreground">{entry.name}</span>
    </div>
  );
}

export function ReferralLeaderboardTable({
  entries,
  insufficientData = false,
}: ReferralLeaderboardTableProps) {
  const totalPages = Math.max(1, Math.ceil(entries.length / REFERRAL_LEADERBOARD_TABLE_PAGE_SIZE));
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "rank",
    direction: "ascending",
  });

  const sortedItems = useMemo(() => {
    return [...entries].sort((a, b) => {
      const column = sortDescriptor.column as keyof ReferralLeaderboardEntry;
      const first = a[column];
      const second = b[column];

      if (typeof first === "number" && typeof second === "number") {
        return sortDescriptor.direction === "descending" ? second - first : first - second;
      }

      if (typeof first === "string" && typeof second === "string") {
        const cmp = first.localeCompare(second);
        return sortDescriptor.direction === "descending" ? cmp * -1 : cmp;
      }

      return 0;
    });
  }, [entries, sortDescriptor]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * REFERRAL_LEADERBOARD_TABLE_PAGE_SIZE;
    return sortedItems.slice(start, start + REFERRAL_LEADERBOARD_TABLE_PAGE_SIZE);
  }, [page, sortedItems]);

  if (insufficientData || entries.length === 0) {
    return (
      <TableCard.Root size="sm">
        <ReferralLeaderboardTableInsufficientState className="border-0 bg-transparent" />
      </TableCard.Root>
    );
  }

  return (
    <TableCard.Root size="sm">
      <Table
        aria-label={copy.referral.leaderboardPageTitle}
        size="sm"
        sortDescriptor={sortDescriptor}
        onSortChange={setSortDescriptor}
      >
        <Table.Header>
          <Table.Head id="rank" label={copy.referral.leaderboardTableRank} isRowHeader allowsSorting />
          <Table.Head id="name" label={copy.referral.leaderboardTableUser} allowsSorting className="w-full max-w-[40%]" />
          <Table.Head id="referralCount" label={copy.referral.leaderboardTableReferrals} allowsSorting />
          <Table.Head id="earningsInr" label={copy.referral.leaderboardTableEarnings} allowsSorting className="text-right [&>div]:justify-end" />
        </Table.Header>

        <Table.Body items={pageItems}>
          {(entry) => (
            <Table.Row id={String(entry.rank)}>
              <Table.Cell className="font-semibold tabular-nums text-muted-foreground">{entry.rank}</Table.Cell>
              <Table.Cell>
                <TableUserCell entry={entry} />
              </Table.Cell>
              <Table.Cell className="tabular-nums">{entry.referralCount}</Table.Cell>
              <Table.Cell className="text-right font-semibold tabular-nums text-success">
                {formatReferralInr(entry.earningsInr)}
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>

      {entries.length > REFERRAL_LEADERBOARD_TABLE_PAGE_SIZE ? (
        <PaginationPageMinimalCenter page={page} total={totalPages} onPageChange={setPage} />
      ) : null}
    </TableCard.Root>
  );
}
