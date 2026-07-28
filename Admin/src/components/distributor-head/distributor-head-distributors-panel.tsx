"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DistributorHeadListToolbar } from "@/components/distributor-head/distributor-head-list-toolbar";
import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableRows,
  paginateItems,
} from "@/components/ui/admin-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DUMMY_DISTRIBUTORS, DUMMY_MANAGERS } from "@/lib/dummy/distributor-head-data";
import {
  distributorHeadDistributorHref,
  matchesDistributorSearch,
} from "@/lib/distributor-head-queries";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";

const STATUS_ALL = "all";
const MANAGER_ALL = "all";

export function DistributorHeadDistributorsPanel() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [managerFilter, setManagerFilter] = useState(MANAGER_ALL);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return DUMMY_DISTRIBUTORS.filter((row) => {
      if (!matchesDistributorSearch(row, search)) return false;
      if (statusFilter !== STATUS_ALL && row.status !== statusFilter) return false;
      if (managerFilter !== MANAGER_ALL && row.managerId !== managerFilter) return false;
      return true;
    });
  }, [managerFilter, search, statusFilter]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, ADMIN_TABLE_PAGE_SIZE),
    [filtered, page],
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const colSpan = 8;

  return (
    <div className="space-y-4">
      <AdminSectionTitle description="Every distributor in the state. Filter by manager or status, then open a profile.">
        All distributors
      </AdminSectionTitle>

      <DistributorHeadListToolbar
        searchPlaceholder="Search by name, ARN, manager, or branch"
        searchValue={search}
        onSearchChange={handleSearchChange}
        filters={
          <>
            <Select
              value={managerFilter}
              onValueChange={(value) => {
                setManagerFilter(value ?? MANAGER_ALL);
                setPage(0);
              }}
            >
              <SelectTrigger size="sm" className="min-w-select-md">
                <SelectValue placeholder="Manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANAGER_ALL}>All managers</SelectItem>
                {DUMMY_MANAGERS.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value ?? STATUS_ALL);
                setPage(0);
              }}
            >
              <SelectTrigger size="sm" className="min-w-select-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Onboarding">Onboarding</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <AdminDataTable minWidth="6xl">
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
          <AdminTableRows
            colSpan={colSpan}
            isEmpty={pagination.items.length === 0}
            emptyMessage="No distributors match your search or filters."
          >
            {pagination.items.map((row) => (
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
            ))}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>

      <AdminTablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        hasPrevious={pagination.hasPrevious}
        hasNext={pagination.hasNext}
        onPrevious={() => setPage((current) => Math.max(0, current - 1))}
        onNext={() => setPage((current) => current + 1)}
      />
    </div>
  );
}
