"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, IndianRupee, Repeat, ShoppingBag, UserRound, Users2 } from "lucide-react";

import {
  DistributorHeadChipBadge,
  DistributorHeadStatusBadge,
} from "@/components/distributor-head/distributor-head-badge";
import { DistributorHeadManagerLeaveTab } from "@/components/distributor-head/distributor-head-manager-leave-tab";
import { AdminFlipMetricCard } from "@/components/ui/admin-flip-metric-card";
import { AdminSecondaryMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
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
import type {
  AdminHierarchyBranch,
  AdminHierarchyBranchStatus,
  AdminHierarchyManager,
  AdminHierarchyPartner,
} from "@/lib/admin-distributor-hierarchy-api";
import {
  matchesHierarchyBranchSearch,
  matchesHierarchyManagerSearch,
  matchesHierarchyPartnerSearch,
} from "@/lib/admin-distributor-hierarchy-mappers";
import { distributorHeadDistributorHref, distributorHeadManagerHref } from "@/lib/distributor-head-queries";
import { distributorHeadBranchHref } from "@/lib/admin-distributor-head-branch-navigation";
import type { DistributorHeadLeaveApplication } from "@/lib/dummy/distributor-head-data";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadCount, formatDistributorHeadInr } from "@/lib/distributor-head-format";

const ALL = "all";

function branchStatusVariant(status: AdminHierarchyBranchStatus): StatusBadgeVariant {
  if (status === "active") return "success";
  if (status === "pending_approval") return "warning";
  if (status === "rejected") return "destructive";
  return "neutral";
}

export function DistributorHeadStateHeadOverviewTab({
  managers,
  branches,
  partners,
  leaveItems,
  aumInr,
  salesMtdInr,
  clientCount,
}: {
  managers: AdminHierarchyManager[];
  branches: AdminHierarchyBranch[];
  partners: AdminHierarchyPartner[];
  leaveItems: DistributorHeadLeaveApplication[];
  aumInr: number;
  salesMtdInr: number;
  clientCount: number;
}) {
  const router = useRouter();
  const pendingBranches = branches.filter((row) => row.status === "pending_approval");
  const unassignedBranches = branches.filter((row) => !row.manager_id);
  const pendingLeave = leaveItems.filter((row) => row.status === "Pending");
  const activePartners = partners.filter((row) => row.status === "Active").length;

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-clip">
      <AdminMetricCardsGrid columns="four" className="mt-0 mb-0 min-w-0 max-w-full">
        <AdminFlipMetricCard
          front={{
            label: "Network AUM",
            value: formatDistributorHeadInr(aumInr),
            icon: IndianRupee,
          }}
          back={{
            label: "Clients",
            value: formatDistributorHeadCount(clientCount),
            icon: UserRound,
          }}
        />
        <AdminFlipMetricCard
          front={{
            label: "Sales MTD",
            value: formatDistributorHeadInr(salesMtdInr),
            icon: ShoppingBag,
          }}
          back={{
            label: `Active ${MITRA_HIERARCHY_COPY.zyndMitras}`,
            value: `${formatDistributorHeadCount(activePartners)} / ${formatDistributorHeadCount(partners.length)}`,
            icon: Users2,
          }}
        />
        <AdminFlipMetricCard
          front={{
            label: "Pending branches",
            value: formatDistributorHeadCount(pendingBranches.length),
            icon: Building2,
          }}
          back={{
            label: "Without manager",
            value: formatDistributorHeadCount(unassignedBranches.length),
            icon: Building2,
          }}
        />
        <AdminFlipMetricCard
          front={{
            label: "Pending leave",
            value: formatDistributorHeadCount(pendingLeave.length),
            icon: Repeat,
          }}
          back={{
            label: `${MITRA_HIERARCHY_COPY.branchManager} applications`,
            value: formatDistributorHeadCount(leaveItems.length),
            icon: Repeat,
          }}
        />
      </AdminMetricCardsGrid>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden border-border/80">
          <CardContent className="space-y-3 p-4">
            <h3 className="font-medium text-foreground">Attention needed</h3>
            {pendingBranches.length === 0 &&
            unassignedBranches.length === 0 &&
            pendingLeave.length === 0 ? (
              <p className="text-compact text-muted-foreground">
                No pending branches, unassigned managers, or leave in this state.
              </p>
            ) : (
              <ul className="space-y-2 text-compact">
                {pendingBranches.slice(0, 5).map((branch) => (
                  <li key={branch.id} className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate">{branch.name}</span>
                    <StatusBadge variant="warning">Pending approval</StatusBadge>
                  </li>
                ))}
                {unassignedBranches
                  .filter((branch) => branch.status !== "pending_approval")
                  .slice(0, 5)
                  .map((branch) => (
                    <li key={`ua-${branch.id}`} className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate">{branch.name}</span>
                      <StatusBadge variant="warning">No manager</StatusBadge>
                    </li>
                  ))}
                {pendingLeave.slice(0, 5).map((leave) => (
                  <li key={leave.id} className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate">{leave.applicantName}</span>
                    <StatusBadge variant="warning">Leave pending</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-border/80">
          <CardContent className="space-y-3 p-4">
            <h3 className="font-medium text-foreground">Top {MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()}</h3>
            {managers.length === 0 ? (
              <p className="text-compact text-muted-foreground">
                No {MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} assigned in this state yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {[...managers]
                  .sort((a, b) => b.sales_mtd_inr - a.sales_mtd_inr || b.partner_count - a.partner_count)
                  .slice(0, 5)
                  .map((manager) => (
                    <li key={manager.id} className="flex min-w-0 items-center justify-between gap-2 text-compact">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{manager.name}</p>
                        <p className="truncate text-muted-foreground">
                          {manager.city || "—"} · {manager.partner_count}{" "}
                          {MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatDistributorHeadInr(manager.sales_mtd_inr)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {branches.slice(0, 6).map((branch) => (
          <Card
            key={branch.id}
            className="min-w-0 cursor-pointer overflow-hidden border-border/80 transition-colors hover:border-primary/30"
            onClick={() => router.push(distributorHeadBranchHref(branch.id))}
          >
            <CardContent className="flex min-w-0 items-start gap-3 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate font-medium text-foreground">{branch.name}</p>
                  <StatusBadge variant={branchStatusVariant(branch.status)}>
                    {branch.status_label}
                  </StatusBadge>
                </div>
                <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                  {branch.city ? (
                    <DistributorHeadChipBadge className="text-muted-foreground">
                      {branch.city}
                    </DistributorHeadChipBadge>
                  ) : null}
                  <Badge variant="outline" className="max-w-full truncate font-normal tabular-nums">
                    {branch.manager_name || "Unassigned"}
                  </Badge>
                  <Badge variant="outline" className="tabular-nums font-normal">
                    {branch.partner_count} {MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()}
                  </Badge>
                  <Badge variant="secondary" className="tabular-nums font-normal">
                    AUM {formatDistributorHeadInr(branch.aum_inr)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DistributorHeadStateHeadManagersTab({
  managers,
}: {
  managers: AdminHierarchyManager[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const statusOptions: AdminSelectOption[] = [
    { value: ALL, label: "All statuses" },
    { value: "Active", label: "Active" },
    { value: "On leave", label: "On leave" },
  ];

  const filtered = useMemo(
    () =>
      managers.filter((row) => {
        if (!matchesHierarchyManagerSearch(row, search)) return false;
        if (statusFilter !== ALL && row.status !== statusFilter) return false;
        return true;
      }),
    [managers, search, statusFilter],
  );
  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const emptyMessage =
    search.trim() || statusFilter !== ALL
      ? `No ${MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} match your search or filters.`
      : `No ${MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} in this state.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:min-w-[14rem]"
          placeholder={`Search ${MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()}`}
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
          options={statusOptions}
          placeholder="Status"
          className="min-w-select-sm shrink-0"
          triggerClassName="w-auto"
          aria-label="Filter branch managers by status"
        />
      </div>
      <AdminDataTable
        minWidth="5xl"
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
            <AdminTableHeadCell>City</AdminTableHeadCell>
            <AdminTableHeadCell>Branches</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitras}</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={7}>{emptyMessage}</AdminTableStateRow>
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

export function DistributorHeadStateHeadBranchesTab({
  branches,
}: {
  branches: AdminHierarchyBranch[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const statusOptions: AdminSelectOption[] = [
    { value: ALL, label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "pending_approval", label: "Pending approval" },
    { value: "rejected", label: "Rejected" },
  ];

  const filtered = useMemo(() => {
    return branches.filter((row) => {
      if (!matchesHierarchyBranchSearch(row, search)) return false;
      if (statusFilter !== ALL && row.status !== statusFilter) return false;
      return true;
    });
  }, [branches, search, statusFilter]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:min-w-[14rem]"
          placeholder="Search branches by name, city, or manager"
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
          options={statusOptions}
          placeholder="Status"
          className="min-w-select-sm shrink-0"
          triggerClassName="w-auto"
          aria-label="Filter branches by status"
        />
      </div>
      <AdminDataTable
        minWidth="5xl"
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
            <AdminTableHeadCell>Branch</AdminTableHeadCell>
            <AdminTableHeadCell>City</AdminTableHeadCell>
            <AdminTableHeadCell>Manager</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitras}</AdminTableHeadCell>
            <AdminTableHeadCell>Clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={7}>No branches in this state.</AdminTableStateRow>
          ) : (
            pagination.items.map((row) => (
              <AdminTableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(distributorHeadBranchHref(row.id))}
              >
                <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                <AdminTableCell>{row.city || "—"}</AdminTableCell>
                <AdminTableCell>{row.manager_name || "Unassigned"}</AdminTableCell>
                <AdminTableCell>{row.partner_count}</AdminTableCell>
                <AdminTableCell>{row.active_clients}</AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.aum_inr)}
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={branchStatusVariant(row.status)}>{row.status_label}</StatusBadge>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}

export function DistributorHeadStateHeadMitrasTab({
  partners,
}: {
  partners: AdminHierarchyPartner[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const filtered = useMemo(
    () => partners.filter((row) => matchesHierarchyPartnerSearch(row, search)),
    [partners, search],
  );
  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  return (
    <div className="space-y-4">
      <AdminSearchInput
        containerClassName="max-w-sm"
        placeholder={`Search ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()}`}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }}
      />
      <AdminDataTable
        minWidth="5xl"
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
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={7}>
              No {MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} in this state.
            </AdminTableStateRow>
          ) : (
            pagination.items.map((row) => (
              <AdminTableRow
                key={row.id}
                onClick={() => router.push(distributorHeadDistributorHref(row.id))}
              >
                <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                <AdminTableCell>{row.arn || "—"}</AdminTableCell>
                <AdminTableCell>{row.manager_name || "—"}</AdminTableCell>
                <AdminTableCell>{row.branch_name || "—"}</AdminTableCell>
                <AdminTableCell>{row.client_count}</AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.aum_inr)}
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

export function DistributorHeadStateHeadBookTab({
  managers,
  partners,
  aumInr,
  salesMtdInr,
  clientCount,
}: {
  managers: AdminHierarchyManager[];
  partners: AdminHierarchyPartner[];
  aumInr: number;
  salesMtdInr: number;
  clientCount: number;
}) {
  const sipMtdInr = Math.round(salesMtdInr * 0.35);
  const lumpsumMtdInr = Math.max(0, salesMtdInr - sipMtdInr);
  const transfersMtdInr = Math.round(salesMtdInr * 0.08);
  const managerSalesTotal = managers.reduce((sum, row) => sum + row.sales_mtd_inr, 0);

  return (
    <div className="space-y-6">
      <AdminMetricCardsGrid columns="four" className="mt-0 mb-0">
        <AdminSecondaryMetricCard
          label="Total AUM"
          value={formatDistributorHeadInr(aumInr)}
          hint={`${formatDistributorHeadCount(clientCount)} investor clients`}
          icon={IndianRupee}
          tone="muted"
        />
        <AdminSecondaryMetricCard
          label="SIP MTD"
          value={formatDistributorHeadInr(sipMtdInr)}
          hint="Estimated from state sales mix"
          icon={Repeat}
          tone="muted"
        />
        <AdminSecondaryMetricCard
          label="One-time / lumpsum MTD"
          value={formatDistributorHeadInr(lumpsumMtdInr)}
          hint="Estimated from state sales mix"
          icon={ShoppingBag}
          tone="muted"
        />
        <AdminSecondaryMetricCard
          label="Transfers / redemptions MTD"
          value={formatDistributorHeadInr(transfersMtdInr)}
          hint="Estimated outflow under this state"
          icon={IndianRupee}
          tone="muted"
        />
      </AdminMetricCardsGrid>

      <AdminDataTable minWidth="4xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.branchManager}</AdminTableHeadCell>
            <AdminTableHeadCell>City</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitras}</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
            <AdminTableHeadCell>Share</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {managers.length === 0 ? (
            <AdminTableStateRow colSpan={5}>
              No manager sales in this state yet.
            </AdminTableStateRow>
          ) : (
            [...managers]
              .sort((a, b) => b.sales_mtd_inr - a.sales_mtd_inr)
              .map((row) => {
                const share =
                  managerSalesTotal > 0 ? (row.sales_mtd_inr / managerSalesTotal) * 100 : 0;
                return (
                  <AdminTableRow key={row.id}>
                    <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                    <AdminTableCell>{row.city || "—"}</AdminTableCell>
                    <AdminTableCell>{row.partner_count}</AdminTableCell>
                    <AdminTableCell className="tabular-nums">
                      {formatDistributorHeadInr(row.sales_mtd_inr)}
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">{share.toFixed(1)}%</AdminTableCell>
                  </AdminTableRow>
                );
              })
          )}
        </AdminTableBody>
      </AdminDataTable>

      <AdminDataTable minWidth="5xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitra}</AdminTableHeadCell>
            <AdminTableHeadCell>Manager</AdminTableHeadCell>
            <AdminTableHeadCell>Clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {partners.length === 0 ? (
            <AdminTableStateRow colSpan={5}>
              No {MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()} books in this state yet.
            </AdminTableStateRow>
          ) : (
            [...partners]
              .sort((a, b) => b.aum_inr - a.aum_inr || b.sales_mtd_inr - a.sales_mtd_inr)
              .slice(0, 25)
              .map((row) => (
                <AdminTableRow key={row.id}>
                  <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                  <AdminTableCell>{row.manager_name || "—"}</AdminTableCell>
                  <AdminTableCell>{row.client_count}</AdminTableCell>
                  <AdminTableCell className="tabular-nums">
                    {formatDistributorHeadInr(row.aum_inr)}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">
                    {formatDistributorHeadInr(row.sales_mtd_inr)}
                  </AdminTableCell>
                </AdminTableRow>
              ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}

export function DistributorHeadStateHeadClientsTab({
  partners,
}: {
  partners: AdminHierarchyPartner[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const statusOptions: AdminSelectOption[] = [
    { value: ALL, label: "All statuses" },
    { value: "Active", label: "Active" },
    { value: "Onboarding", label: "Onboarding" },
    { value: "Suspended", label: "Suspended" },
  ];

  const rows = useMemo(() => {
    return partners
      .map((partner) => ({
        id: partner.id,
        mitraName: partner.name,
        managerName: partner.manager_name || "—",
        branchName: partner.branch_name || "—",
        clientCount: partner.client_count,
        aumInr: partner.aum_inr,
        status: partner.status,
      }))
      .filter((row) => {
        if (statusFilter !== ALL && row.status !== statusFilter) return false;
        const normalized = search.trim().toLowerCase();
        if (!normalized) return true;
        return (
          row.mitraName.toLowerCase().includes(normalized) ||
          row.managerName.toLowerCase().includes(normalized) ||
          row.branchName.toLowerCase().includes(normalized)
        );
      });
  }, [partners, search, statusFilter]);

  const pagination = useMemo(
    () => paginateItems(rows, page, pageSize),
    [page, pageSize, rows],
  );

  const emptyMessage =
    search.trim() || statusFilter !== ALL
      ? "No client books match your search or filters."
      : "No client books under this state yet.";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:min-w-[14rem]"
          placeholder={`Search by ${MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()}, manager, or branch`}
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
          options={statusOptions}
          placeholder="Status"
          className="min-w-select-sm shrink-0"
          triggerClassName="w-auto"
          aria-label="Filter client books by status"
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
            totalCount={rows.length}
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
            <AdminTableHeadCell>Manager</AdminTableHeadCell>
            <AdminTableHeadCell>Branch</AdminTableHeadCell>
            <AdminTableHeadCell>Clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={6}>{emptyMessage}</AdminTableStateRow>
          ) : (
            pagination.items.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="font-medium">{row.mitraName}</AdminTableCell>
                <AdminTableCell>{row.managerName}</AdminTableCell>
                <AdminTableCell>{row.branchName}</AdminTableCell>
                <AdminTableCell>{row.clientCount}</AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.aumInr)}
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

export function DistributorHeadStateHeadLeaveTab({
  leaveItems,
}: {
  leaveItems: DistributorHeadLeaveApplication[];
}) {
  const managerLeave = leaveItems.filter((row) => row.applicantRole === "Manager");
  const teamLeave = leaveItems.filter((row) => row.applicantRole === "Distributor");
  return <DistributorHeadManagerLeaveTab managerLeave={managerLeave} teamLeave={teamLeave} />;
}
