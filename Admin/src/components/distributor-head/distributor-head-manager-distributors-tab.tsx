"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DistributorHeadChipBadge,
  DistributorHeadStatusBadge,
} from "@/components/distributor-head/distributor-head-badge";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import type { DistributorHeadDistributor } from "@/lib/dummy/distributor-head-data";
import {
  distributorHeadDistributorHref,
  matchesDistributorSearch,
} from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";

const STATUS_ALL = "all";
const TABLE_COLUMNS = 7;

const STATUS_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: STATUS_ALL, label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "Onboarding", label: "Onboarding" },
  { value: "Suspended", label: "Suspended" },
];

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

export function DistributorHeadManagerDistributorsTab({
  team,
}: {
  team: DistributorHeadDistributor[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const filtered = useMemo(() => {
    return team.filter((row) => {
      if (!matchesDistributorSearch(row, search)) return false;
      if (statusFilter !== STATUS_ALL && row.status !== statusFilter) return false;
      return true;
    });
  }, [search, statusFilter, team]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search by name, ARN, or branch"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <AdminSelect
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(0);
          }}
          options={STATUS_FILTER_OPTIONS}
          placeholder="Status"
          className="min-w-select-sm"
        />
      </div>

      <AdminDataTable
        minWidth="6xl"
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
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitra}</AdminTableHeadCell>
            <AdminTableHeadCell>Branch</AdminTableHeadCell>
            <AdminTableHeadCell>Clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
            <AdminTableHeadCell>Book</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={TABLE_COLUMNS}>
              No {MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} on this team match your filters.
            </AdminTableStateRow>
          ) : (
            pagination.items.map((row) => (
              <AdminTableRow
                key={row.id}
                onClick={() => router.push(distributorHeadDistributorHref(row.id))}
              >
                <AdminTableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-primary/10 text-caption font-medium text-primary">
                        {initialsFromName(row.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium">{row.name}</p>
                      <Badge variant="outline" className="mt-1 h-5 font-mono text-micro font-normal">
                        {row.arn}
                      </Badge>
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <DistributorHeadChipBadge>{row.branchName}</DistributorHeadChipBadge>
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">{row.clientCount}</AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.aumInr)}
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.salesMtdInr)}
                </AdminTableCell>
                <AdminTableCell>
                  <Badge variant="secondary" className="tabular-nums font-normal">
                    {formatDistributorHeadInr(row.aumInr)} AUM
                  </Badge>
                </AdminTableCell>
                <AdminTableCell>
                  <DistributorHeadStatusBadge status={row.status} />
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
