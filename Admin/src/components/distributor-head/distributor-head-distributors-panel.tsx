"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
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
import { DUMMY_DISTRIBUTORS, DUMMY_MANAGERS } from "@/lib/dummy/distributor-head-data";
import {
  distributorHeadDistributorHref,
  matchesDistributorSearch,
} from "@/lib/distributor-head-queries";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";

const STATUS_ALL = "all";
const MANAGER_ALL = "all";
const TABLE_COLUMN_COUNT = 8;

const STATUS_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: STATUS_ALL, label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "Onboarding", label: "Onboarding" },
  { value: "Suspended", label: "Suspended" },
];

export function DistributorHeadDistributorsPanel() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [managerFilter, setManagerFilter] = useState(MANAGER_ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const managerFilterOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: MANAGER_ALL, label: "All managers" },
      ...DUMMY_MANAGERS.map((manager) => ({ value: manager.id, label: manager.name })),
    ],
    [],
  );

  const filtered = useMemo(() => {
    return DUMMY_DISTRIBUTORS.filter((row) => {
      if (!matchesDistributorSearch(row, search)) return false;
      if (statusFilter !== STATUS_ALL && row.status !== statusFilter) return false;
      if (managerFilter !== MANAGER_ALL && row.managerId !== managerFilter) return false;
      return true;
    });
  }, [managerFilter, search, statusFilter]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search by name, ARN, manager, or branch"
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <AdminSelect
            value={managerFilter}
            onValueChange={(value) => {
              setManagerFilter(value);
              setPage(0);
            }}
            options={managerFilterOptions}
            placeholder="Manager"
            className="min-w-select-md"
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
            <AdminTableHeadCell>Name</AdminTableHeadCell>
            <AdminTableHeadCell>ARN</AdminTableHeadCell>
            <AdminTableHeadCell>Manager</AdminTableHeadCell>
            <AdminTableHeadCell>Branch</AdminTableHeadCell>
            <AdminTableHeadCell>Clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={TABLE_COLUMN_COUNT}>
              No distributors match your search or filters.
            </AdminTableStateRow>
          ) : (
            pagination.items.map((row) => (
              <AdminTableRow
                key={row.id}
                onClick={() => router.push(distributorHeadDistributorHref(row.id))}
              >
                <AdminTableCell>
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-caption text-muted-foreground">{row.email}</p>
                  </div>
                </AdminTableCell>
                <AdminTableCell className="font-mono text-caption">{row.arn}</AdminTableCell>
                <AdminTableCell>{row.managerName}</AdminTableCell>
                <AdminTableCell>{row.branchName}</AdminTableCell>
                <AdminTableCell>{row.clientCount}</AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.aumInr)}
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.salesMtdInr)}
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
