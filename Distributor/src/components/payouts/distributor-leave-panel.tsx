"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Palmtree, Plus, Stethoscope, Sun } from "lucide-react";

import { DistributorApplyLeaveDialog } from "@/components/payouts/distributor-apply-leave-dialog";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import {
  DUMMY_DISTRIBUTOR_LEAVE_BALANCES,
  DUMMY_DISTRIBUTOR_LEAVE_REQUESTS,
  getLeaveRequestStatusLabel,
  type DistributorLeaveBalance,
  type DistributorLeaveRequest,
  type DistributorLeaveType,
} from "@/lib/distributor-job-dashboard-data";
import { fetchDistributorLeaveRequests } from "@/lib/distributor-work-api";
import { formatDistributorDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

const LEAVE_DETAIL_HREF = "/dashboard/payouts/leave";
const RECENT_REQUEST_LIMIT_DEFAULT = 3;

type DistributorLeavePanelProps = {
  className?: string;
  variant?: "default" | "sidebar";
};

const LEAVE_TYPE_META: Record<
  Exclude<DistributorLeaveType, "Unpaid">,
  { icon: typeof Palmtree; accentClass: string; barClass: string }
> = {
  Annual: {
    icon: Palmtree,
    accentClass: "distributor-leave-panel__balance-card--annual",
    barClass: "distributor-job-sidebar-leave-bar--annual",
  },
  Sick: {
    icon: Stethoscope,
    accentClass: "distributor-leave-panel__balance-card--sick",
    barClass: "distributor-job-sidebar-leave-bar--sick",
  },
  Casual: {
    icon: Sun,
    accentClass: "distributor-leave-panel__balance-card--casual",
    barClass: "distributor-job-sidebar-leave-bar--casual",
  },
};

function leaveStatusVariant(status: DistributorLeaveRequest["status"]): StatusBadgeVariant {
  if (status === "Approved") return "success";
  if (status === "Pending") return "warning";
  return "destructive";
}

function formatLeaveDates(request: DistributorLeaveRequest): string {
  const from = formatDistributorDate(request.fromDate);
  if (request.fromDate === request.toDate) return from;
  return `${from} – ${formatDistributorDate(request.toDate)}`;
}

function LeaveBalanceCard({ balance }: { balance: DistributorLeaveBalance }) {
  const meta = LEAVE_TYPE_META[balance.type as Exclude<DistributorLeaveType, "Unpaid">];
  const Icon = meta?.icon ?? CalendarDays;
  const usedPct = balance.total > 0 ? Math.round((balance.used / balance.total) * 100) : 0;

  return (
    <article
      className={cn("distributor-leave-panel__balance-card", meta?.accentClass)}
      aria-label={`${balance.type} leave balance`}
    >
      <div className="distributor-leave-panel__balance-head">
        <span className="distributor-leave-panel__balance-icon" aria-hidden>
          <Icon className="size-3.5" strokeWidth={2.25} />
        </span>
        <p className="distributor-leave-panel__balance-type">{balance.type}</p>
      </div>

      <p className="distributor-leave-panel__balance-remaining tabular-nums">
        {balance.remaining}
        <span className="distributor-leave-panel__balance-unit"> left</span>
      </p>

      <div className="distributor-leave-panel__balance-progress" aria-hidden>
        <span
          className="distributor-leave-panel__balance-progress-fill"
          style={{ width: `${usedPct}%` }}
        />
      </div>

      <p className="distributor-leave-panel__balance-meta tabular-nums">
        {balance.used} used · {balance.total} total
      </p>
    </article>
  );
}

function LeaveSidebarBalanceRow({ balance }: { balance: DistributorLeaveBalance }) {
  const meta = LEAVE_TYPE_META[balance.type as Exclude<DistributorLeaveType, "Unpaid">];
  const Icon = meta?.icon ?? CalendarDays;
  const usedPct = balance.total > 0 ? Math.round((balance.used / balance.total) * 100) : 0;

  return (
    <div className="distributor-job-sidebar-leave-row" aria-label={`${balance.type} leave balance`}>
      <span className="distributor-job-sidebar-leave-row__icon" aria-hidden>
        <Icon className="size-3" strokeWidth={2.25} />
      </span>
      <div className="distributor-job-sidebar-leave-row__track" aria-hidden>
        <span
          className={cn("distributor-job-sidebar-leave-row__fill", meta?.barClass)}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <span className="distributor-job-sidebar-leave-row__value tabular-nums">{balance.remaining}</span>
    </div>
  );
}

function LeaveSidebarCard({
  className,
  balances,
  pendingCount,
  pendingRequest,
  onApply,
}: {
  className?: string;
  balances: DistributorLeaveBalance[];
  pendingCount: number;
  pendingRequest: DistributorLeaveRequest | null;
  onApply: () => void;
}) {
  return (
    <article className={cn("distributor-job-sidebar-card distributor-job-sidebar-card--leave", className)} aria-label="Time off">
      <div className="distributor-job-sidebar-card__head">
        <div>
          <p className="distributor-job-sidebar-card__eyebrow">Time off</p>
          <h2 className="distributor-job-sidebar-card__title">Leave balance</h2>
        </div>
        <div className="distributor-job-sidebar-card__actions">
          {pendingCount > 0 ? (
            <StatusBadge variant="warning">
              {pendingCount}
            </StatusBadge>
          ) : null}
          <button
            type="button"
            className="distributor-job-sidebar-card__icon-btn"
            aria-label="Apply for leave"
            onClick={onApply}
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
          </button>
          <Link href={LEAVE_DETAIL_HREF} className="distributor-job-sidebar-card__icon-btn" aria-label="Leave history">
            <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
          </Link>
        </div>
      </div>

      <div className="distributor-job-sidebar-leave-rows">
        {balances.map((balance) => (
          <LeaveSidebarBalanceRow key={balance.type} balance={balance} />
        ))}
      </div>

      {pendingRequest ? (
        <div className="distributor-job-sidebar-leave-pending">
          <span className="distributor-job-sidebar-leave-pending__dot" aria-hidden />
          <span className="distributor-job-sidebar-leave-pending__copy">
            {pendingRequest.type} · {pendingRequest.days}d · Pending
          </span>
        </div>
      ) : null}
    </article>
  );
}

export function DistributorLeavePanel({
  className,
  variant = "default",
}: DistributorLeavePanelProps) {
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [requests, setRequests] = useState<DistributorLeaveRequest[]>(DUMMY_DISTRIBUTOR_LEAVE_REQUESTS);
  const balances = DUMMY_DISTRIBUTOR_LEAVE_BALANCES;
  const isSidebar = variant === "sidebar";

  const reloadRequests = () => {
    void fetchDistributorLeaveRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  };

  useEffect(() => {
    reloadRequests();
  }, []);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "Pending").length,
    [requests],
  );

  const pendingRequest = useMemo(
    () => requests.find((request) => request.status === "Pending") ?? null,
    [requests],
  );

  const recentRequests = useMemo(
    () =>
      [...requests]
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
        .slice(0, RECENT_REQUEST_LIMIT_DEFAULT),
    [requests],
  );

  return (
    <>
      {isSidebar ? (
        <LeaveSidebarCard
          className={className}
          balances={balances}
          pendingCount={pendingCount}
          pendingRequest={pendingRequest}
          onApply={() => setLeaveDialogOpen(true)}
        />
      ) : (
        <section className={cn("distributor-leave-panel", className)} aria-label="Time off">
          <div className="distributor-leave-panel__main">
            <div className="distributor-leave-panel__copy">
              <p className="distributor-leave-panel__eyebrow">Time off</p>
              <div className="distributor-leave-panel__title-row">
                <h2 className="distributor-leave-panel__title">Leave balance</h2>
                {pendingCount > 0 ? (
                  <StatusBadge variant="warning">
                    {pendingCount} pending
                  </StatusBadge>
                ) : null}
              </div>
            </div>

            <DistributorActionButton
              type="button"
              variant="outline"
              size="sm"
              className="distributor-leave-panel__apply gap-1.5"
              onClick={() => setLeaveDialogOpen(true)}
            >
              <Plus className="size-3.5" aria-hidden />
              Apply leave
            </DistributorActionButton>
          </div>

          <div className="distributor-leave-panel__balances">
            {balances.map((balance) => (
              <LeaveBalanceCard key={balance.type} balance={balance} />
            ))}
          </div>

          <div className="distributor-leave-panel__requests">
            <p className="distributor-leave-panel__requests-label">Recent requests</p>
            <ul className="distributor-leave-panel__request-list">
              {recentRequests.map((request) => (
                <li
                  key={request.id}
                  className={cn(
                    "distributor-leave-panel__request-row",
                    `distributor-leave-panel__request-row--${request.status.toLowerCase()}`,
                  )}
                >
                  <span className="distributor-leave-panel__request-icon" aria-hidden>
                    <CalendarDays className="size-4" strokeWidth={2.25} />
                  </span>
                  <span className="distributor-leave-panel__request-copy">
                    <span className="distributor-leave-panel__request-title">
                      {request.type} · {request.days} day{request.days === 1 ? "" : "s"}
                    </span>
                    <span className="distributor-leave-panel__request-meta">
                      {formatLeaveDates(request)} · {request.reason}
                    </span>
                  </span>
                  <StatusBadge variant={leaveStatusVariant(request.status)}>
                    {getLeaveRequestStatusLabel(request.status)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </div>

          <Link href={LEAVE_DETAIL_HREF} className="distributor-leave-panel__cta">
            <span>View leave history</span>
            <ArrowUpRight className="size-4" strokeWidth={2.25} aria-hidden />
          </Link>
        </section>
      )}

      <DistributorApplyLeaveDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        balances={balances}
        onSubmitted={reloadRequests}
      />
    </>
  );
}
