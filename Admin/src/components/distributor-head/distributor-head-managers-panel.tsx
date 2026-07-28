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
import { DUMMY_MANAGERS, DUMMY_STATE_HEAD } from "@/lib/dummy/distributor-head-data";
import {
  distributorHeadManagerHref,
  matchesManagerSearch,
} from "@/lib/distributor-head-queries";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";

const STATUS_ALL = "all";

export function DistributorHeadManagersPanel() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return DUMMY_MANAGERS.filter((row) => {
      if (!matchesManagerSearch(row, search)) return false;
      if (statusFilter !== STATUS_ALL && row.status !== statusFilter) return false;
      return true;
    });
  }, [search, statusFilter]);

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
      <AdminSectionTitle description="Branch managers reporting to this state head. Open a row for branches and distributors under them.">
        Managers in {DUMMY_STATE_HEAD.state}
      </AdminSectionTitle>

      <DistributorHeadListToolbar
        searchPlaceholder="Search managers by name, email, or city"
        searchValue={search}
        onSearchChange={handleSearchChange}
        filters={
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
              <SelectItem value="On leave">On leave</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <AdminDataTable minWidth="6xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Name</AdminTableHeadCell>
            <AdminTableHeadCell>Email</AdminTableHeadCell>
            <AdminTableHeadCell>Primary city</AdminTableHeadCell>
            <AdminTableHeadCell>Branches</AdminTableHeadCell>
            <AdminTableHeadCell>Distributors</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
            <AdminTableHeadCell>Sales YTD</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows
            colSpan={colSpan}
            isEmpty={pagination.items.length === 0}
            emptyMessage="No managers match your search or filters."
          >
            {pagination.items.map((row) => (
              <AdminTableRow
                key={row.id}
                onClick={() => router.push(distributorHeadManagerHref(row.id))}
              >
                <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                <AdminTableCell>{row.email}</AdminTableCell>
                <AdminTableCell>{row.city}</AdminTableCell>
                <AdminTableCell>{row.branchIds.length}</AdminTableCell>
                <AdminTableCell>{row.distributorCount}</AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.salesMtdInr)}
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.salesYtdInr)}
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
