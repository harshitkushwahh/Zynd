"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDateTime } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";

export type DistributorActivityLogEntry = {
  id: string;
  summary: string;
  actor: string;
  createdAt: string;
};

type DistributorActivityLogTableProps = {
  entries: DistributorActivityLogEntry[];
  ariaLabel?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Filter controls rendered on the left of the toolbar (e.g. actor dropdown). */
  toolbarFilters?: ReactNode;
  /** Search control rendered on the right; pair with `search` / `onSearchChange`. */
  toolbarSearch?: ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  onToolbarClear?: () => void;
  toolbarClearDisabled?: boolean;
  className?: string;
};

function actorVariant(actor: string): "info" | "neutral" {
  const normalized = actor.trim().toLowerCase();
  if (normalized === "system" || normalized.includes("routing")) {
    return "info";
  }
  return "neutral";
}

export function DistributorActivityLogTable({
  entries,
  ariaLabel = "Activity log",
  searchPlaceholder = "Search activity…",
  emptyTitle = "No activity yet",
  emptyDescription = "Events will appear here as the ticket is updated.",
  toolbarFilters,
  toolbarSearch,
  search: controlledSearch,
  onSearchChange,
  onToolbarClear,
  toolbarClearDisabled,
  className,
}: DistributorActivityLogTableProps) {
  const [internalSearch, setInternalSearch] = useState("");
  const search = controlledSearch ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    return entries.filter((entry) =>
      distributorTableSearchMatch(search, entry.summary, entry.actor, entry.createdAt),
    );
  }, [entries, search]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  useEffect(() => {
    setPage(1);
  }, [entries, search, setPage]);

  const searchControl =
    toolbarSearch ??
    (
      <DistributorTableSearchCard
        variant="card"
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />
    );

  const toolbar = (
    <DistributorTableToolbar
      className="distributor-client-activity-tab__toolbar"
      onClearAll={() => {
        if (onToolbarClear) {
          onToolbarClear();
        } else {
          setSearch("");
        }
        setPage(1);
      }}
      clearDisabled={toolbarClearDisabled ?? search.trim() === ""}
      search={searchControl}
    >
      {toolbarFilters}
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label={ariaLabel}
      selectionMode="none"
      className="min-w-0 w-full"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head
          id="createdAt"
          label="When"
          isRowHeader
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
        <Table.Head id="summary" label="Activity" allowsSorting />
        <Table.Head id="actor" label="Actor" allowsSorting />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(entry) => (
          <Table.Row id={entry.id}>
            <Table.Cell
              className={cn(
                "whitespace-nowrap tabular-nums text-muted-foreground",
                DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
              )}
            >
              {formatDistributorDateTime(entry.createdAt)}
            </Table.Cell>
            <Table.Cell className="max-w-[28rem] font-medium text-foreground">{entry.summary}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={actorVariant(entry.actor)} showIcon={false}>
                {entry.actor}
              </StatusBadge>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={cn("min-h-0 min-w-0", className)}>
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
