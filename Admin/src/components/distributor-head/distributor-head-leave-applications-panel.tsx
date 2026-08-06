"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Inbox, MapPin, Scale } from "lucide-react";

import { AdminCenteredConfirmDialog } from "@/components/ui/admin-centered-confirm-dialog";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import type { DistributorHeadLeaveApplication } from "@/lib/dummy/distributor-head-data";
import { getLeaveForStateHead } from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { cn } from "@/lib/utils";

type LeaveConfirmAction = "approve" | "decline";

type LeaveConfirmTarget = {
  action: LeaveConfirmAction;
  item: DistributorHeadLeaveApplication;
};

const STATUS_ALL = "all";

const STATUS_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: STATUS_ALL, label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

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

function LeaveApplicationItem({
  item,
  onApprove,
  onDecline,
}: {
  item: DistributorHeadLeaveApplication;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const isPending = item.status === "Pending";

  return (
    <li
      className={cn(
        "distributor-head-leave-inbox__item",
        isPending && "distributor-head-leave-inbox__item--pending",
        !isPending && "distributor-head-leave-inbox__item--resolved",
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "distributor-head-leave-inbox__avatar",
            item.applicantRole === "Manager" && "distributor-head-leave-inbox__avatar--manager",
          )}
        >
          {initialsFromName(item.applicantName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{item.applicantName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="h-5 font-normal text-micro">
                  {item.applicantRole}
                </Badge>
                <span className="text-caption text-muted-foreground">{item.branchName}</span>
              </div>
            </div>
            <DistributorHeadStatusBadge status={item.status} className="shrink-0" />
          </div>

          <p className="mt-2.5 text-sm font-medium text-foreground">{item.leaveType}</p>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className="distributor-head-leave-inbox__meta">
              <CalendarDays className="size-3.5 shrink-0 opacity-80" />
              {formatLeaveDate(item.startDate)} – {formatLeaveDate(item.endDate)}
              <span className="text-muted-foreground/90">· {item.days}d</span>
            </span>
            <span className="distributor-head-leave-inbox__meta">
              <MapPin className="size-3.5 shrink-0 opacity-80" />
              {item.city}
            </span>
          </div>

          <p className="distributor-head-leave-inbox__reason">{item.reason}</p>

          <p className="mt-2 text-micro text-muted-foreground">
            Submitted {formatSubmittedAt(item.submittedAt)}
          </p>

          {isPending ? (
            <div className="mt-3 flex gap-2 sm:max-w-xs">
              <Button type="button" size="sm" className="h-8 flex-1" onClick={onApprove}>
                Approve
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 flex-1" onClick={onDecline}>
                Decline
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function DistributorHeadLeaveApplicationsPanel() {
  const [items, setItems] = useState<DistributorHeadLeaveApplication[]>(() => [
    ...getLeaveForStateHead(),
  ]);
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [confirmTarget, setConfirmTarget] = useState<LeaveConfirmTarget | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const pendingCount = items.filter((row) => row.status === "Pending").length;

  const filtered = useMemo(() => {
    const rows =
      statusFilter === STATUS_ALL
        ? items
        : items.filter((row) => row.status === statusFilter);

    return [...rows].sort((a, b) => {
      if (a.status === "Pending" && b.status !== "Pending") return -1;
      if (a.status !== "Pending" && b.status === "Pending") return 1;
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  }, [items, statusFilter]);

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
    statusFilter === STATUS_ALL
      ? `No ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} leave requests in your state.`
      : `No ${statusFilter.toLowerCase()} leave requests.`;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminSelect
            containerClassName="w-full sm:w-44"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            aria-label="Filter leave applications by status"
          />
          {pendingCount > 0 ? (
            <Badge className="w-fit tabular-nums">{pendingCount} pending</Badge>
          ) : (
            <Badge variant="secondary" className="w-fit font-normal">
              All caught up
            </Badge>
          )}
        </div>

        <Card className="distributor-head-leave-inbox min-w-0 border border-border shadow-none ring-0">
          <CardHeader className="distributor-head-leave-inbox__header border-b border-border/60 px-4 pb-3 pt-4 sm:px-5">
            <div className="flex items-start gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Inbox className="size-4" strokeWidth={2} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Leave applications</CardTitle>
                <p className="text-caption text-muted-foreground">
                  {MITRA_HIERARCHY_COPY.branchManager} requests in your state
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-compact text-muted-foreground">{emptyMessage}</p>
            ) : (
              <ul className="distributor-head-leave-inbox__list">
                {filtered.map((item) => (
                  <LeaveApplicationItem
                    key={item.id}
                    item={item}
                    onApprove={() => setConfirmTarget({ action: "approve", item })}
                    onDecline={() => setConfirmTarget({ action: "decline", item })}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
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
