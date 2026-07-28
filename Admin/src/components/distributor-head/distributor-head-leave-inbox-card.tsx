"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Inbox, MapPin, Scale } from "lucide-react";

import { AdminCenteredConfirmDialog } from "@/components/ui/admin-centered-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import {
  DUMMY_LEAVE_APPLICATIONS,
  type DistributorHeadLeaveApplication,
} from "@/lib/dummy/distributor-head-data";
import { cn } from "@/lib/utils";

type LeaveConfirmAction = "approve" | "decline";

type LeaveConfirmTarget = {
  action: LeaveConfirmAction;
  item: DistributorHeadLeaveApplication;
};

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

function LeaveInboxItem({
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
            <div className="mt-3 flex gap-2">
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

export function DistributorHeadLeaveInboxCard() {
  const [items, setItems] = useState<DistributorHeadLeaveApplication[]>(() => [
    ...DUMMY_LEAVE_APPLICATIONS,
  ]);
  const [confirmTarget, setConfirmTarget] = useState<LeaveConfirmTarget | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const pendingCount = items.filter((row) => row.status === "Pending").length;

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.status === "Pending" && b.status !== "Pending") return -1;
        if (a.status !== "Pending" && b.status === "Pending") return 1;
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }),
    [items],
  );

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

  return (
    <>
      <Card className="distributor-head-leave-inbox overflow-hidden">
        <CardHeader className="distributor-head-leave-inbox__header border-b border-border/60 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Inbox className="size-4" strokeWidth={2} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Leave inbox</CardTitle>
                <p className="text-caption text-muted-foreground">Applications in your state</p>
              </div>
            </div>
            {pendingCount > 0 ? (
              <Badge className="shrink-0 tabular-nums">{pendingCount} pending</Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0 font-normal">
                All caught up
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="distributor-head-leave-inbox__list max-h-[32rem] overflow-y-auto">
            {sorted.map((item) => (
              <LeaveInboxItem
                key={item.id}
                item={item}
                onApprove={() => setConfirmTarget({ action: "approve", item })}
                onDecline={() => setConfirmTarget({ action: "decline", item })}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

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
