"use client";

import { useEffect, useMemo, useState } from "react";
import { Scale } from "lucide-react";

import { AdminCenteredConfirmDialog } from "@/components/ui/admin-centered-confirm-dialog";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
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
import type { DistributorHeadLeaveApplication } from "@/lib/dummy/distributor-head-data";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";

type LeaveConfirmAction = "approve" | "decline";

type LeaveConfirmTarget = {
  action: LeaveConfirmAction;
  item: DistributorHeadLeaveApplication;
};

const STATUS_ALL = "all";
const TABLE_COLUMN_COUNT = 7;

const STATUS_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: STATUS_ALL, label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

function formatLeaveDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSubmittedAt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function leaveConfirmDescription(item: DistributorHeadLeaveApplication) {
  return `${item.applicantName} · ${item.leaveType} · ${formatLeaveDate(item.startDate)} – ${formatLeaveDate(item.endDate)} (${item.days} day${item.days === 1 ? "" : "s"}) at ${item.branchName}, ${item.city}.`;
}

function leaveConfirmIntro(action: LeaveConfirmAction) {
  return action === "approve"
    ? "You are approving this leave request."
    : "You are declining this leave request.";
}

function matchesLeaveSearch(item: DistributorHeadLeaveApplication, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    item.applicantName,
    item.applicantRole,
    item.branchName,
    item.city,
    item.leaveType,
    item.reason,
    item.status,
  ].some((value) => value.toLowerCase().includes(normalized));
}

export function DistributorHeadLeaveApplicationsPanel() {
  const [items, setItems] = useState<DistributorHeadLeaveApplication[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [confirmTarget, setConfirmTarget] = useState<LeaveConfirmTarget | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const pendingCount = items.filter((row) => row.status === "Pending").length;

  const filtered = useMemo(() => {
    const rows = items.filter((row) => {
      if (statusFilter !== STATUS_ALL && row.status !== statusFilter) return false;
      return matchesLeaveSearch(row, search);
    });

    return [...rows].sort((a, b) => {
      if (a.status === "Pending" && b.status !== "Pending") return -1;
      if (a.status !== "Pending" && b.status === "Pending") return 1;
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  }, [items, search, statusFilter]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);

  const closeConfirm = () => {
    if (confirmLoading) return;
    setConfirmTarget(null);
  };

  const handleConfirm = () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    const nextStatus = confirmTarget.action === "approve" ? "Approved" : "Rejected";
    const itemId = confirmTarget.item.id;
    window.setTimeout(() => {
      setItems((current) =>
        current.map((row) => (row.id === itemId ? { ...row, status: nextStatus } : row)),
      );
      setConfirmLoading(false);
      setConfirmTarget(null);
    }, 350);
  };

  const isApprove = confirmTarget?.action === "approve";
  const emptyMessage =
    search.trim() || statusFilter !== STATUS_ALL
      ? `No leave requests match your search or filters.`
      : `No ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} leave requests in your state.`;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminSearchInput
            containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
            placeholder={`Search ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} leave by name, branch, or type`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <AdminSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
              placeholder="Status"
              className="min-w-select-sm shrink-0"
              triggerClassName="w-auto"
              aria-label="Filter leave applications by status"
            />
            {pendingCount > 0 ? (
              <Badge className="shrink-0 tabular-nums">{pendingCount} pending</Badge>
            ) : null}
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
              pageSize={pageSize}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(0);
              }}
              onPrevious={() => setPage((value) => Math.max(0, value - 1))}
              onNext={() => setPage((value) => value + 1)}
            />
          }
        >
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Applicant</AdminTableHeadCell>
              <AdminTableHeadCell>Branch</AdminTableHeadCell>
              <AdminTableHeadCell>Leave</AdminTableHeadCell>
              <AdminTableHeadCell>Dates</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
              <AdminTableHeadCell>Submitted</AdminTableHeadCell>
              <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {pagination.items.length === 0 ? (
              <AdminTableStateRow colSpan={TABLE_COLUMN_COUNT}>{emptyMessage}</AdminTableStateRow>
            ) : (
              pagination.items.map((item) => (
                <AdminTableRow key={item.id}>
                  <AdminTableCell>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{item.applicantName}</p>
                      <p className="text-caption text-muted-foreground">{item.applicantRole}</p>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="min-w-0">
                      <p className="text-foreground">{item.branchName}</p>
                      <p className="text-caption text-muted-foreground">{item.city}</p>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="max-w-xs">
                    <p className="font-medium text-foreground">{item.leaveType}</p>
                    <p className="truncate text-caption text-muted-foreground" title={item.reason}>
                      {item.reason}
                    </p>
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                    {formatLeaveDate(item.startDate)} – {formatLeaveDate(item.endDate)}
                    <span className="block text-caption">{item.days} day{item.days === 1 ? "" : "s"}</span>
                  </AdminTableCell>
                  <AdminTableCell>
                    <DistributorHeadStatusBadge status={item.status} />
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                    {formatSubmittedAt(item.submittedAt)}
                  </AdminTableCell>
                  <AdminTableCell className="text-right">
                    {item.status === "Pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8"
                          onClick={() => setConfirmTarget({ action: "approve", item })}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => setConfirmTarget({ action: "decline", item })}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <span className="text-caption text-muted-foreground">—</span>
                    )}
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminDataTable>
      </div>

      <AdminCenteredConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) closeConfirm();
        }}
        title={isApprove ? "Approve leave request?" : "Decline leave request?"}
        description={
          confirmTarget
            ? `${leaveConfirmIntro(confirmTarget.action)} ${leaveConfirmDescription(confirmTarget.item)}`
            : ""
        }
        confirmLabel={isApprove ? "Approve leave" : "Decline leave"}
        cancelLabel="Cancel"
        loading={confirmLoading}
        onConfirm={handleConfirm}
        icon={Scale}
        iconTone={isApprove ? "success" : "destructive"}
        confirmVariant={isApprove ? "default" : "destructive"}
      />
    </>
  );
}
