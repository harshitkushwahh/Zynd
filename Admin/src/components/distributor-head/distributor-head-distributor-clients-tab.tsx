"use client";

import { useMemo, useState } from "react";

import { DistributorHeadChipBadge } from "@/components/distributor-head/distributor-head-badge";
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
import type { DistributorHeadManagerClient } from "@/lib/dummy/distributor-head-data";
import { matchesDistributorClientSearch } from "@/lib/distributor-head-queries";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";

const CLIENT_STATUS_ALL = "all";
const TABLE_COLUMNS = 5;

const CLIENT_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: CLIENT_STATUS_ALL, label: "All clients" },
  { value: "invested", label: "Invested" },
  { value: "not_invested", label: "Not invested" },
  { value: "kyc_pending", label: "KYC pending" },
];

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

export function DistributorHeadDistributorClientsTab({
  clients,
}: {
  clients: DistributorHeadManagerClient[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(CLIENT_STATUS_ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const filtered = useMemo(() => {
    return clients.filter((row) => {
      if (!matchesDistributorClientSearch(row, search)) return false;
      if (statusFilter === "invested" && !row.hasInvested) return false;
      if (statusFilter === "not_invested" && row.hasInvested) return false;
      if (statusFilter === "kyc_pending" && row.kycCompliant) return false;
      return true;
    });
  }, [clients, search, statusFilter]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search clients by name or email"
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
          options={CLIENT_FILTER_OPTIONS}
          placeholder="Filter"
          className="min-w-select-md"
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
            <AdminTableHeadCell>Client</AdminTableHeadCell>
            <AdminTableHeadCell>Branch</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Investment</AdminTableHeadCell>
            <AdminTableHeadCell>KYC</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={TABLE_COLUMNS}>
              No clients match your filters.
            </AdminTableStateRow>
          ) : (
            pagination.items.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback className="text-caption font-medium">
                        {initialsFromName(row.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium">{row.name}</p>
                      <p className="truncate text-caption text-muted-foreground">{row.email}</p>
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <DistributorHeadChipBadge className="text-muted-foreground">
                    {row.branchName}
                  </DistributorHeadChipBadge>
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.aumInr)}
                </AdminTableCell>
                <AdminTableCell>
                  <Badge
                    variant="outline"
                    className={
                      row.hasInvested
                        ? "border-success/30 bg-success/10 text-success"
                        : "text-muted-foreground"
                    }
                  >
                    {row.hasInvested ? "Invested" : "Not invested"}
                  </Badge>
                </AdminTableCell>
                <AdminTableCell>
                  <Badge
                    variant="outline"
                    className={
                      row.kycCompliant
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-warning/30 bg-warning/10 text-warning"
                    }
                  >
                    {row.kycCompliant ? "Compliant" : "Pending"}
                  </Badge>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
