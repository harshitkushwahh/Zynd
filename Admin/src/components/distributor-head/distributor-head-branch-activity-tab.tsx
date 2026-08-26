"use client";

import { useMemo, useState } from "react";

import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
  paginateItems,
} from "@/components/ui/admin-table";
import type { AdminHierarchyBranchDetail } from "@/lib/admin-distributor-hierarchy-api";
import {
  branchActivityKindLabel,
  branchActivityKindVariant,
  buildBranchActivityEvents,
  matchesBranchActivitySearch,
} from "@/lib/admin-distributor-branch-activity";
import { formatTimestampDetail } from "@/lib/format-date";

const ALL = "all";
const TABLE_COLUMNS = 4;

const EVENT_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All events" },
  { value: "opening_request", label: "Opening request" },
  { value: "approval", label: "Approval" },
  { value: "rejection", label: "Rejection" },
  { value: "manager_assignment", label: "Manager assignment" },
];

export function DistributorHeadBranchActivityTab({
  branch,
}: {
  branch: AdminHierarchyBranchDetail;
}) {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const events = useMemo(() => buildBranchActivityEvents(branch), [branch]);

  const filtered = useMemo(() => {
    return events.filter((row) => {
      if (eventFilter !== ALL && row.kind !== eventFilter) return false;
      return matchesBranchActivitySearch(row, search);
    });
  }, [eventFilter, events, search]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const emptyMessage =
    search.trim() || eventFilter !== ALL
      ? "No activity matches your search or filters."
      : "No activity recorded for this branch yet.";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:min-w-[14rem]"
          placeholder="Search events, actors, or summaries"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <AdminSelect
          value={eventFilter}
          onValueChange={(value) => {
            setEventFilter(value);
            setPage(0);
          }}
          options={EVENT_FILTER_OPTIONS}
          placeholder="Event type"
          className="min-w-select-sm shrink-0"
          triggerClassName="w-auto"
          aria-label="Filter branch activity by event type"
        />
      </div>

      <AdminDataTable
        minWidth="4xl"
        footer={
          <AdminTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            totalCount={filtered.length}
            currentPageCount={pagination.items.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(0);
            }}
            onPrevious={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Event</AdminTableHeadCell>
            <AdminTableHeadCell>Actor</AdminTableHeadCell>
            <AdminTableHeadCell>Date & time</AdminTableHeadCell>
            <AdminTableHeadCell>Summary</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={TABLE_COLUMNS}>{emptyMessage}</AdminTableStateRow>
          ) : (
            pagination.items.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="font-medium text-foreground">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span>{row.eventLabel}</span>
                    <StatusBadge
                      variant={branchActivityKindVariant(row.kind)}
                      showIcon={false}
                      className="w-fit normal-case"
                    >
                      {branchActivityKindLabel(row.kind)}
                    </StatusBadge>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-compact">{row.actorName}</span>
                    {row.actorEmail ? (
                      <span className="truncate text-caption text-muted-foreground">{row.actorEmail}</span>
                    ) : null}
                  </div>
                </AdminTableCell>
                <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                  {row.occurredAt ? formatTimestampDetail(row.occurredAt) : "—"}
                </AdminTableCell>
                <AdminTableCell className="min-w-0 text-muted-foreground">{row.summary}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
