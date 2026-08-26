"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  IndianRupee,
  Network,
  Repeat,
  ShoppingBag,
  UserRound,
  Users2,
} from "lucide-react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminFlipMetricCard } from "@/components/ui/admin-flip-metric-card";
import { AdminSecondaryMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Card, CardContent } from "@/components/ui/card";
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
  AdminHierarchyBranchDetail,
  AdminHierarchyPartner,
} from "@/lib/admin-distributor-hierarchy-api";
import { matchesHierarchyPartnerSearch } from "@/lib/admin-distributor-hierarchy-mappers";
import { distributorHeadDistributorHref } from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatTimestampDetail } from "@/lib/format-date";
import { formatDistributorHeadCount, formatDistributorHeadInr } from "@/lib/distributor-head-format";
import { cn } from "@/lib/utils";

const ALL = "all";

type ProgressStep = {
  key: string;
  title: string;
  caption?: string | null;
  state: "complete" | "current" | "upcoming" | "rejected";
};

function buildOpeningProgressSteps(branch: AdminHierarchyBranchDetail): ProgressStep[] {
  const createdCaption = branch.created_by_name
    ? branch.created_at
      ? `${branch.created_by_name} · ${formatTimestampDetail(branch.created_at)}`
      : branch.created_by_name
    : branch.created_at
      ? formatTimestampDetail(branch.created_at)
      : null;

  const approvalCaption =
    branch.status === "rejected"
      ? branch.approved_by_name
        ? `Rejected by ${branch.approved_by_name}${branch.approved_at ? ` · ${formatTimestampDetail(branch.approved_at)}` : ""}`
        : branch.rejection_reason
      : branch.status === "active" && branch.approved_at
        ? branch.approved_by_name
          ? `${branch.approved_by_name} · ${formatTimestampDetail(branch.approved_at)}`
          : formatTimestampDetail(branch.approved_at)
        : branch.status === "pending_approval"
          ? "Waiting for Mitra Super Head approval"
          : null;

  const managerCaption = branch.manager_name
    ? branch.manager_name
    : branch.status === "active"
      ? `Assign a ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} to start onboarding`
      : "Available after approval";

  const activeCaption =
    branch.status === "active"
      ? branch.manager_id
        ? `${MITRA_HIERARCHY_COPY.zyndMitras} can onboard here`
        : "Waiting for manager assignment"
      : branch.status === "rejected"
        ? branch.rejection_reason ?? "Opening request declined"
        : "Opens after approval";

  const approvalState: ProgressStep["state"] =
    branch.status === "rejected"
      ? "rejected"
      : branch.status === "pending_approval"
        ? "current"
        : "complete";

  const managerState: ProgressStep["state"] =
    branch.status === "active"
      ? branch.manager_id
        ? "complete"
        : "current"
      : "upcoming";

  const activeState: ProgressStep["state"] =
    branch.status === "active" && branch.manager_id
      ? "complete"
      : branch.status === "active"
        ? "current"
        : branch.status === "rejected"
          ? "rejected"
          : "upcoming";

  return [
    { key: "created", title: "Request submitted", caption: createdCaption, state: "complete" },
    {
      key: "approval",
      title:
        branch.status === "rejected"
          ? "Rejected"
          : branch.status === "active"
            ? "Approved"
            : "Awaiting approval",
      caption: approvalCaption,
      state: approvalState,
    },
    {
      key: "manager",
      title: branch.manager_id ? "Manager assigned" : "Assign manager",
      caption: managerCaption,
      state: managerState,
    },
    {
      key: "active",
      title: branch.status === "rejected" ? "Not opened" : "Live",
      caption: activeCaption,
      state: activeState,
    },
  ];
}

function progressRailDotClass(state: ProgressStep["state"]) {
  if (state === "complete") return "border-success/40 bg-success/10 [&>span]:bg-success";
  if (state === "rejected") return "border-destructive/40 bg-destructive/10 [&>span]:bg-destructive";
  if (state === "current") return "border-warning/40 bg-warning/10 [&>span]:bg-warning";
  return "border-border bg-muted/30 [&>span]:bg-muted-foreground/40";
}

function progressStepSurfaceClass(state: ProgressStep["state"]) {
  if (state === "complete") return "border-border/70 bg-muted/10";
  if (state === "rejected") return "border-destructive/30 bg-destructive/5";
  if (state === "current") return "border-warning/30 bg-warning/5";
  return "border-border/50 bg-transparent opacity-80";
}

function progressConnectorClass(state: ProgressStep["state"]) {
  if (state === "complete") return "bg-success/35";
  if (state === "rejected") return "bg-destructive/25";
  if (state === "current") return "bg-warning/30";
  return "bg-border";
}

function BranchOpeningProgress({ steps }: { steps: ProgressStep[] }) {
  return (
    <Card className="min-w-0 overflow-visible border border-border/80 ring-0 shadow-none">
      <CardContent className="p-4 sm:p-5">
        <p className="text-compact font-semibold text-foreground">Opening progress</p>
        <ol className="mt-3">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            return (
              <li key={step.key} className="flex min-w-0 gap-3">
                <div className="flex w-timeline-rail shrink-0 flex-col items-center self-stretch pt-1">
                  <span
                    className={cn(
                      "relative z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full border",
                      progressRailDotClass(step.state),
                    )}
                  >
                    <span className="size-1.5 rounded-full" />
                  </span>
                  {!isLast ? (
                    <span
                      className={cn("mt-1 w-px flex-1 min-h-5", progressConnectorClass(step.state))}
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className={cn("min-w-0 flex-1", !isLast && "pb-3")}>
                  <div
                    className={cn(
                      "min-w-0 rounded-lg border px-3 py-2",
                      progressStepSurfaceClass(step.state),
                    )}
                  >
                    <p
                      className={cn(
                        "text-caption font-medium leading-snug",
                        step.state === "rejected" && "text-destructive",
                        step.state === "upcoming" && "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                    {step.caption ? (
                      <p className="mt-1 text-caption leading-snug text-muted-foreground">{step.caption}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export function DistributorHeadBranchOverviewTab({
  branch,
  partners,
  clientCount,
  aumInr,
  salesMtdInr,
}: {
  branch: AdminHierarchyBranchDetail;
  partners: AdminHierarchyPartner[];
  clientCount: number;
  aumInr: number;
  salesMtdInr: number;
}) {
  const steps = useMemo(() => buildOpeningProgressSteps(branch), [branch]);
  const activePartners = partners.filter((row) => row.status === "Active").length;
  const pendingPartners = partners.filter((row) => row.status === "Onboarding").length;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <AdminMetricCardsGrid columns="four" className="mt-0 mb-0 min-w-0 max-w-full">
        <AdminFlipMetricCard
          front={{
            label: "Branch AUM",
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
            icon: Network,
          }}
        />
        <AdminFlipMetricCard
          front={{
            label: MITRA_HIERARCHY_COPY.branchManager,
            value: branch.manager_id ? "Assigned" : "Unassigned",
            icon: Users2,
          }}
          back={{
            label: "Onboarding queue",
            value: formatDistributorHeadCount(pendingPartners),
            icon: Repeat,
          }}
        />
        <AdminFlipMetricCard
          front={{
            label: "Opening status",
            value: branch.status_label,
            icon: CheckCircle2,
          }}
          back={{
            label: "Branch code",
            value: branch.branch_code ?? branch.id.toUpperCase(),
            icon: Network,
          }}
        />
      </AdminMetricCardsGrid>

      <div className="grid min-w-0 gap-4 overflow-visible px-0.5 lg:grid-cols-2">
        <BranchOpeningProgress steps={steps} />

        <Card className="min-w-0 overflow-visible border border-border/80 ring-0 shadow-none">
          <CardContent className="space-y-2 p-4 sm:p-5">
            <p className="text-compact font-semibold text-foreground">Attention needed</p>
            {branch.status === "pending_approval" ? (
              <p className="text-compact text-muted-foreground">
                This branch opening is waiting for Mitra Super Head approval.
              </p>
            ) : branch.status === "rejected" ? (
              <p className="text-compact text-muted-foreground">
                {branch.rejection_reason ?? "This opening request was declined."}
              </p>
            ) : !branch.manager_id ? (
              <p className="text-compact text-muted-foreground">
                Assign a {MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} before onboarding{" "}
                {MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} here.
              </p>
            ) : pendingPartners > 0 ? (
              <p className="text-compact text-muted-foreground">
                {pendingPartners} {MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()}
                {pendingPartners === 1 ? "" : "s"} still onboarding under this branch.
              </p>
            ) : (
              <p className="text-compact text-muted-foreground">No pending items for this branch.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DistributorHeadBranchMitrasTab({
  partners,
}: {
  partners: AdminHierarchyPartner[];
}) {
  const router = useRouter();
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

  const filtered = useMemo(() => {
    return partners.filter((row) => {
      if (statusFilter !== ALL && row.status !== statusFilter) return false;
      return matchesHierarchyPartnerSearch(row, search);
    });
  }, [partners, search, statusFilter]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const emptyMessage =
    search.trim() || statusFilter !== ALL
      ? `No ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} match your search or filters.`
      : `No ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} under this branch yet.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:min-w-[14rem]"
          placeholder={`Search ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()}`}
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
          aria-label={`Filter ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} by status`}
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
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitra}</AdminTableHeadCell>
            <AdminTableHeadCell>ARN</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.branchManager}</AdminTableHeadCell>
            <AdminTableHeadCell>Clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
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
                className="cursor-pointer"
                onClick={() => router.push(distributorHeadDistributorHref(row.id))}
              >
                <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                <AdminTableCell className="font-mono text-xs">{row.arn || "—"}</AdminTableCell>
                <AdminTableCell>{row.manager_name ?? "—"}</AdminTableCell>
                <AdminTableCell>{row.client_count}</AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  {formatDistributorHeadInr(row.aum_inr)}
                </AdminTableCell>
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

export function DistributorHeadBranchClientsTab({
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
          row.managerName.toLowerCase().includes(normalized)
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
      : "No client books under this branch yet.";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:min-w-[14rem]"
          placeholder={`Search by ${MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()} or manager`}
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
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.branchManager}</AdminTableHeadCell>
            <AdminTableHeadCell>Clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={5}>{emptyMessage}</AdminTableStateRow>
          ) : (
            pagination.items.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="font-medium">{row.mitraName}</AdminTableCell>
                <AdminTableCell>{row.managerName}</AdminTableCell>
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

export function DistributorHeadBranchBookTab({
  branch,
  partners,
  aumInr,
  salesMtdInr,
  clientCount,
}: {
  branch: AdminHierarchyBranchDetail;
  partners: AdminHierarchyPartner[];
  aumInr: number;
  salesMtdInr: number;
  clientCount: number;
}) {
  const sipMtdInr = Math.round(salesMtdInr * 0.35);
  const lumpsumMtdInr = Math.max(0, salesMtdInr - sipMtdInr);
  const transfersMtdInr = Math.round(salesMtdInr * 0.08);

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
          hint="Estimated from branch sales mix"
          icon={Repeat}
          tone="muted"
        />
        <AdminSecondaryMetricCard
          label="One-time / lumpsum MTD"
          value={formatDistributorHeadInr(lumpsumMtdInr)}
          hint="Estimated from branch sales mix"
          icon={ShoppingBag}
          tone="muted"
        />
        <AdminSecondaryMetricCard
          label="Transfers / redemptions MTD"
          value={formatDistributorHeadInr(transfersMtdInr)}
          hint="Estimated outflow under this branch"
          icon={IndianRupee}
          tone="muted"
        />
      </AdminMetricCardsGrid>

      <AdminDataTable minWidth="4xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitra}</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.branchManager}</AdminTableHeadCell>
            <AdminTableHeadCell>Clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {partners.length === 0 ? (
            <AdminTableStateRow colSpan={5}>
              No book data under {branch.name} yet.
            </AdminTableStateRow>
          ) : (
            partners.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                <AdminTableCell>{row.manager_name ?? "—"}</AdminTableCell>
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
