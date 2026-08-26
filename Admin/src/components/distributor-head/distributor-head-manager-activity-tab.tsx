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
import type { DistributorHeadManagerAuditLog } from "@/lib/dummy/distributor-head-data";
import { matchesManagerAuditSearch } from "@/lib/distributor-head-queries";
import { formatTimestampDetail } from "@/lib/format-date";

const ALL = "all";
const TABLE_COLUMNS = 4;

const ACTOR_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All actors" },
  { value: "manager", label: "Manager" },
  { value: "distributor", label: "Distributor" },
  { value: "system", label: "System" },
];

function actorVariant(actor: DistributorHeadManagerAuditLog["actorType"]) {
  if (actor === "manager") return "info" as const;
  if (actor === "distributor") return "success" as const;
  return "neutral" as const;
}

export function DistributorHeadManagerActivityTab({
  logs,
}: {
  logs: DistributorHeadManagerAuditLog[];
}) {
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const filtered = useMemo(() => {
    return logs.filter((row) => {
      if (actorFilter !== ALL && row.actorType !== actorFilter) return false;
      return matchesManagerAuditSearch(row, search);
    });
  }, [actorFilter, logs, search]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

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
          value={actorFilter}
          onValueChange={(value) => {
            setActorFilter(value);
            setPage(0);
          }}
          options={ACTOR_FILTER_OPTIONS}
          placeholder="Actor"
          className="min-w-select-sm shrink-0 self-end sm:self-auto"
          triggerClassName="w-auto"
          aria-label="Filter activity by actor"
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
            <AdminTableStateRow colSpan={TABLE_COLUMNS}>
              No activity matches your filters.
            </AdminTableStateRow>
          ) : (
            pagination.items.map((log) => (
              <AdminTableRow key={log.id}>
                <AdminTableCell className="font-medium text-foreground">
                  {log.eventType}
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-compact">{log.actorName}</span>
                    <StatusBadge variant={actorVariant(log.actorType)} showIcon={false}>
                      {log.actorType}
                    </StatusBadge>
                  </div>
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatTimestampDetail(log.createdAt)}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">{log.summary}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
