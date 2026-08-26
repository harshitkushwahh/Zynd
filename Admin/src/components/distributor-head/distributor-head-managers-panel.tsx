"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { DistributorHeadAddMitraManagerDialog } from "@/components/distributor-head/distributor-head-add-mitra-manager-dialog";
import { DistributorHeadMitraManagerInvitationsTable } from "@/components/distributor-head/distributor-head-mitra-manager-invitations-table";
import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { Button } from "@/components/ui/button";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableSkeletonRows,
  AdminTableStateRow,
  paginateItems,
} from "@/components/ui/admin-table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  fetchAdminHierarchyManagers,
  type AdminHierarchyManager,
} from "@/lib/admin-distributor-hierarchy-api";
import { DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION } from "@/lib/admin-distributor-head-navigation";
import { matchesHierarchyManagerSearch } from "@/lib/admin-distributor-hierarchy-mappers";
import {
  distributorHeadManagerHref,
} from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";
import { getErrorMessage, isIgnorableListLoadError } from "@/lib/errors";

const STATUS_ALL = "all";
const TABLE_COLUMN_COUNT = 8;

type ManagersPanelSubTab = "managers" | "invitations";

const STATUS_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: STATUS_ALL, label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "On leave", label: "On leave" },
];

export function DistributorHeadManagersPanel() {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission(DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION);
  const [subTab, setSubTab] = useState<ManagersPanelSubTab>("managers");
  const [items, setItems] = useState<AdminHierarchyManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [addOpen, setAddOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [invitationsRefreshKey, setInvitationsRefreshKey] = useState(0);

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
      ? `No ${MITRA_HIERARCHY_COPY.mitraManagers.toLowerCase()} match your search or filters.`
      : `No ${MITRA_HIERARCHY_COPY.mitraManagers.toLowerCase()} yet.${canManage ? " Use Add to invite or assign one." : ""}`;

  const managersTable = (
    <>
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
            <AdminTableSkeletonRows columns={TABLE_COLUMN_COUNT} rows={6} />
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
    </>
  );

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {successMessage ? (
        <AdminFeedbackMessage variant="success" onDismiss={() => setSuccessMessage("")}>
          {successMessage}
        </AdminFeedbackMessage>
      ) : null}

      {canManage ? (
        <Tabs
          value={subTab}
          onValueChange={(value) => {
            if (value === "managers" || value === "invitations") {
              setSubTab(value);
            }
          }}
          className="gap-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <AdminSearchInput
              containerClassName="w-full max-w-sm lg:min-w-[16rem]"
              placeholder={`Search ${MITRA_HIERARCHY_COPY.mitraManagers.toLowerCase()} by name, email, or city`}
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {subTab === "managers" ? (
                <AdminSelect
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(0);
                  }}
                  options={STATUS_FILTER_OPTIONS}
                  placeholder="Status"
                  className="min-w-select-sm shrink-0"
                  triggerClassName="w-auto"
                  aria-label="Filter branch managers by status"
                />
              ) : null}

              <Button type="button" size="sm" className="shrink-0 gap-2" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Add {MITRA_HIERARCHY_COPY.mitraManager}
              </Button>

              <AdminTabList variant="secondary" className="max-w-full overflow-x-auto">
                <AdminTabTrigger value="managers">{MITRA_HIERARCHY_COPY.branchManagers}</AdminTabTrigger>
                <AdminTabTrigger value="invitations">Invitations</AdminTabTrigger>
              </AdminTabList>
            </div>
          </div>

          <TabsContent value="managers" className="mt-0 space-y-4">
            {managersTable}
          </TabsContent>

          <TabsContent value="invitations" className="mt-0">
            <DistributorHeadMitraManagerInvitationsTable refreshKey={invitationsRefreshKey} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AdminSearchInput
              containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
              placeholder={`Search ${MITRA_HIERARCHY_COPY.mitraManagers.toLowerCase()} by name, email, or city`}
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
            <AdminSelect
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(0);
              }}
              options={STATUS_FILTER_OPTIONS}
              placeholder="Status"
              className="min-w-select-sm shrink-0"
              triggerClassName="w-auto"
              aria-label="Filter branch managers by status"
            />
          </div>
          {managersTable}
        </div>
      )}

      <DistributorHeadAddMitraManagerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          setSuccessMessage(`${MITRA_HIERARCHY_COPY.mitraManager} assigned to branch.`);
          setInvitationsRefreshKey((current) => current + 1);
          setSubTab("managers");
          void load();
        }}
        onInvited={(email) => {
          setSuccessMessage(`Invitation sent to ${email}.`);
          setInvitationsRefreshKey((current) => current + 1);
          setSubTab("invitations");
        }}
      />
    </div>
  );
}
