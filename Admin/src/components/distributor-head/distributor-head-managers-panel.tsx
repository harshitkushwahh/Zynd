"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
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
import {
  fetchAdminHierarchyManagers,
  type AdminHierarchyManager,
} from "@/lib/admin-distributor-hierarchy-api";
import { matchesHierarchyManagerSearch } from "@/lib/admin-distributor-hierarchy-mappers";
import {
  distributorHeadManagerHref,
} from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";
import { getErrorMessage, isIgnorableListLoadError } from "@/lib/errors";

const STATUS_ALL = "all";
const TABLE_COLUMN_COUNT = 8;

const STATUS_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: STATUS_ALL, label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "On leave", label: "On leave" },
];

export function DistributorHeadManagersPanel() {
  const router = useRouter();
  const [items, setItems] = useState<AdminHierarchyManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminHierarchyManagers();
      setItems(result);
    } catch (err) {
      setItems([]);
      if (!isIgnorableListLoadError(err)) {
        setError(getErrorMessage(err, `Could not load ${MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()}.`));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((row) => {
      if (!matchesHierarchyManagerSearch(row, search)) return false;
      if (statusFilter !== STATUS_ALL && row.status !== statusFilter) return false;
      return true;
    });
  }, [items, search, statusFilter]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const emptyMessage =
    search.trim() || statusFilter !== STATUS_ALL
      ? `No ${MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} match your search or filters.`
      : `No ${MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} yet. Create a branch on the Branches tab and assign a manager.`;

  const showEmptyNetworkHint =
    !loading && !error && items.length === 0 && !search.trim() && statusFilter === STATUS_ALL;

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {showEmptyNetworkHint ? (
        <AdminFeedbackMessage variant="info">
          The hierarchy network is empty after reset. Add a {MITRA_HIERARCHY_COPY.stateHead.toLowerCase()} on
          the {MITRA_HIERARCHY_COPY.stateHead}s tab, then create branches and assign branch managers.
        </AdminFeedbackMessage>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder={`Search ${MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} by name, email, or city`}
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
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
            <AdminTableHeadCell>Email</AdminTableHeadCell>
            <AdminTableHeadCell>Primary city</AdminTableHeadCell>
            <AdminTableHeadCell>Branches</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitras}</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
            <AdminTableHeadCell>Sales YTD</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableStateRow colSpan={TABLE_COLUMN_COUNT}>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Loading {MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()}…
              </span>
            </AdminTableStateRow>
          ) : pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={TABLE_COLUMN_COUNT}>
              {emptyMessage}
            </AdminTableStateRow>
          ) : (
            pagination.items.map((row) => (
              <AdminTableRow
                key={row.id}
                onClick={() => router.push(distributorHeadManagerHref(row.id))}
              >
                <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                <AdminTableCell>{row.email}</AdminTableCell>
                <AdminTableCell>{row.city || "—"}</AdminTableCell>
                <AdminTableCell>{row.branch_ids.length}</AdminTableCell>
                <AdminTableCell>{row.partner_count}</AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.sales_mtd_inr)}
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.sales_ytd_inr)}
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
