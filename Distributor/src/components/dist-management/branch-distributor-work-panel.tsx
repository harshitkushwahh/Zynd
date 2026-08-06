"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Hourglass,
  IndianRupee,
  XCircle,
} from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { BranchDistributorLeaveReviewDialog } from "@/components/dist-management/branch-distributor-leave-review-dialog";
import {
  BRANCH_DISTRIBUTOR_WORK_SUB_TAB_LABELS,
  type BranchDistributorWorkSubTabId,
} from "@/components/dist-management/branch-distributor-work-sub-tab-ids";
import { BranchDistributorWorkSubTabs } from "@/components/dist-management/branch-distributor-work-sub-tabs";
import {
  BranchDistributorSquareCardGrid,
  BranchDistributorSquareMetricCard,
} from "@/components/dist-management/branch-distributor-square-card";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import {
  attendanceStatusLabel,
  formatClockTime,
  WORK_TYPE_OPTIONS,
  workTypeVariant,
} from "@/components/payouts/distributor-work-attendance-shared";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { BranchDistributorProfile } from "@/lib/distributor-branch-distributor-profile-data";
import {
  getBranchDistributorWorkSnapshot,
} from "@/lib/distributor-branch-distributor-ops-data";
import {
  getLeaveRequestStatusLabel,
  LEAVE_REQUEST_STATUS_OPTIONS,
  type DistributorJobWorkDay,
  type DistributorLeaveRequest,
  type DistributorLeaveRequestStatus,
  type DistributorLeaveType,
  type DistributorWorkAttendanceRow,
  type DistributorWorkAttendanceStatus,
  type DistributorWorkLocationType,
} from "@/lib/distributor-job-dashboard-data";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate, formatPortfolioMetricAmount } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

function leaveStatusVariant(status: DistributorLeaveRequestStatus): StatusBadgeVariant {
  if (status === "Approved") return "success";
  if (status === "Pending") return "warning";
  if (status === "Rejected") return "destructive";
  return "neutral";
}

function workDayStatusVariant(status: DistributorJobWorkDay["status"]): StatusBadgeVariant {
  if (status === "present") return "success";
  if (status === "half-day") return "warning";
  if (status === "leave") return "info";
  return "neutral";
}

function workDayStatusLabel(status: DistributorJobWorkDay["status"]): string {
  if (status === "present") return "Present";
  if (status === "half-day") return "Half day";
  if (status === "leave") return "Leave";
  return "Holiday";
}

const WORK_DAY_STATUS_OPTIONS: Array<{ value: DistributorJobWorkDay["status"]; label: string }> = [
  { value: "present", label: "Present" },
  { value: "half-day", label: "Half day" },
  { value: "leave", label: "Leave" },
  { value: "holiday", label: "Holiday" },
];

const ATTENDANCE_STATUS_OPTIONS: Array<{ value: DistributorWorkAttendanceStatus; label: string }> = [
  { value: "complete", label: "Complete" },
  { value: "partial", label: "Partial" },
  { value: "leave", label: "Leave" },
  { value: "holiday", label: "Holiday" },
];

const LEAVE_TYPE_OPTIONS: Array<{ value: DistributorLeaveType; label: string }> = [
  { value: "Annual", label: "Annual" },
  { value: "Sick", label: "Sick" },
  { value: "Casual", label: "Casual" },
  { value: "Unpaid", label: "Unpaid" },
];

type WorkSubTabMetric = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "accent" | "soft";
};

function WorkSubTabMetricCards({ metrics }: { metrics: WorkSubTabMetric[] }) {
  return (
    <BranchDistributorSquareCardGrid columns={4}>
      {metrics.map((metric) => (
        <BranchDistributorSquareMetricCard
          key={metric.label}
          icon={metric.icon}
          label={metric.label}
          value={metric.value}
          hint={metric.hint}
          tone={metric.tone}
        />
      ))}
    </BranchDistributorSquareCardGrid>
  );
}

type BranchDistributorWorkPanelProps = {
  profile: BranchDistributorProfile;
  className?: string;
};

export function BranchDistributorWorkPanel({
  profile,
  className,
}: BranchDistributorWorkPanelProps) {
  const snapshot = useMemo(
    () => getBranchDistributorWorkSnapshot(profile),
    [profile],
  );
  const [leaveRequests, setLeaveRequests] = useState(snapshot.leaveRequests);
  const [selectedLeave, setSelectedLeave] = useState<DistributorLeaveRequest | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<BranchDistributorWorkSubTabId>("hours");
  const [isSubTabPending, startSubTabTransition] = useTransition();

  useEffect(() => {
    setLeaveRequests(snapshot.leaveRequests);
  }, [profile.id, snapshot.leaveRequests]);

  const [hoursSearch, setHoursSearch] = useState("");
  const [hoursStatusFilter, setHoursStatusFilter] = useState<DistributorJobWorkDay["status"] | "all">("all");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceWorkTypeFilter, setAttendanceWorkTypeFilter] = useState<
    DistributorWorkLocationType | "all"
  >("all");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<
    DistributorWorkAttendanceStatus | "all"
  >("all");
  const [leaveSearch, setLeaveSearch] = useState("");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<DistributorLeaveRequestStatus | "all">("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<DistributorLeaveType | "all">("all");

  const [attendanceSort, setAttendanceSort] = useState<SortDescriptor>({
    column: "date",
    direction: "descending",
  });
  const [leaveSort, setLeaveSort] = useState<SortDescriptor>({
    column: "appliedAt",
    direction: "descending",
  });

  const leaveSubmittedCount = leaveRequests.length;
  const leavePendingCount = useMemo(
    () => leaveRequests.filter((row) => row.status === "Pending").length,
    [leaveRequests],
  );
  const leaveApprovedCount = useMemo(
    () => leaveRequests.filter((row) => row.status === "Approved").length,
    [leaveRequests],
  );
  const leaveRejectedCount = useMemo(
    () => leaveRequests.filter((row) => row.status === "Rejected").length,
    [leaveRequests],
  );

  const hoursMetrics = useMemo((): WorkSubTabMetric[] => {
    const days = snapshot.workHours.daily;
    const presentDays = days.filter((row) => row.status === "present").length;
    const halfDays = days.filter((row) => row.status === "half-day").length;
    const offDays = days.filter((row) => row.status === "leave" || row.status === "holiday").length;

    return [
      {
        icon: FileText,
        label: "Submitted",
        value: String(days.length),
        hint: `${snapshot.workHours.totalHours}h this week`,
      },
      {
        icon: Hourglass,
        label: "In progress",
        value: String(halfDays),
        hint: "Half-day entries",
        tone: "soft",
      },
      {
        icon: CheckCircle2,
        label: "Approved",
        value: String(presentDays),
        hint: "Full present days",
      },
      {
        icon: XCircle,
        label: "Declined",
        value: String(offDays),
        hint: "Leave or holiday",
      },
    ];
  }, [snapshot.workHours.daily, snapshot.workHours.totalHours]);

  const attendanceMetrics = useMemo((): WorkSubTabMetric[] => {
    const rows = snapshot.attendanceRows;
    const completeCount = rows.filter((row) => row.status === "complete").length;
    const partialCount = rows.filter((row) => row.status === "partial").length;
    const offCount = rows.filter((row) => row.status === "leave" || row.status === "holiday").length;

    return [
      {
        icon: FileText,
        label: "Submitted",
        value: String(rows.length),
        hint: "Attendance records",
      },
      {
        icon: Hourglass,
        label: "In progress",
        value: String(partialCount),
        hint: "Partial clock-in/out",
        tone: "soft",
      },
      {
        icon: CheckCircle2,
        label: "Approved",
        value: String(completeCount),
        hint: "Complete days",
      },
      {
        icon: XCircle,
        label: "Declined",
        value: String(offCount),
        hint: "Leave or holiday",
      },
    ];
  }, [snapshot.attendanceRows]);

  const leaveMetrics = useMemo((): WorkSubTabMetric[] => {
    return [
      {
        icon: FileText,
        label: "Submitted",
        value: String(leaveSubmittedCount),
        hint: "All-time applications",
      },
      {
        icon: Hourglass,
        label: "In progress",
        value: String(leavePendingCount),
        hint: "Awaiting your review",
        tone: "soft",
      },
      {
        icon: CheckCircle2,
        label: "Approved",
        value: String(leaveApprovedCount),
        hint: "Approved requests",
      },
      {
        icon: XCircle,
        label: "Declined",
        value: String(leaveRejectedCount),
        hint: "Rejected requests",
      },
    ];
  }, [leaveApprovedCount, leavePendingCount, leaveRejectedCount, leaveSubmittedCount]);

  const filteredHours = useMemo(() => {
    return snapshot.workHours.daily.filter((row) => {
      if (hoursStatusFilter !== "all" && row.status !== hoursStatusFilter) return false;
      return distributorTableSearchMatch(
        hoursSearch,
        row.day,
        workDayStatusLabel(row.status),
        row.status,
      );
    });
  }, [hoursSearch, hoursStatusFilter, snapshot.workHours.daily]);

  const filteredAttendance = useMemo(() => {
    return snapshot.attendanceRows.filter((row) => {
      if (attendanceWorkTypeFilter !== "all" && row.workType !== attendanceWorkTypeFilter) {
        return false;
      }
      if (attendanceStatusFilter !== "all" && row.status !== attendanceStatusFilter) {
        return false;
      }
      return distributorTableSearchMatch(
        attendanceSearch,
        formatDistributorDate(row.date),
        row.workType ?? "",
        row.status,
        attendanceStatusLabel(row) ?? "",
      );
    });
  }, [
    attendanceSearch,
    attendanceStatusFilter,
    attendanceWorkTypeFilter,
    snapshot.attendanceRows,
  ]);

  const filteredLeave = useMemo(() => {
    return leaveRequests.filter((row) => {
      if (leaveStatusFilter !== "all" && row.status !== leaveStatusFilter) return false;
      if (leaveTypeFilter !== "all" && row.type !== leaveTypeFilter) return false;
      return distributorTableSearchMatch(
        leaveSearch,
        row.type,
        row.status,
        row.reason,
        getLeaveRequestStatusLabel(row.status),
      );
    });
  }, [leaveRequests, leaveSearch, leaveStatusFilter, leaveTypeFilter]);

  const sortedAttendance = useMemo(
    () => sortByDescriptor(filteredAttendance, attendanceSort),
    [attendanceSort, filteredAttendance],
  );
  const sortedLeave = useMemo(
    () => sortByDescriptor(filteredLeave, leaveSort),
    [filteredLeave, leaveSort],
  );

  const hoursPagination = useDistributorTablePagination(filteredHours);
  const attendancePagination = useDistributorTablePagination(sortedAttendance);
  const leavePagination = useDistributorTablePagination(sortedLeave);

  const commissionRow = snapshot.commissionRow;

  const openLeaveDialog = useCallback((request: DistributorLeaveRequest) => {
    setSelectedLeave(request);
    setLeaveDialogOpen(true);
  }, []);

  const onSubTabChange = useCallback((tab: BranchDistributorWorkSubTabId) => {
    startSubTabTransition(() => {
      setActiveSubTab(tab);
    });
  }, []);

  const handleLeaveReview = useCallback(
    (requestId: string, decision: "Approved" | "Rejected", reviewNote: string) => {
      setLeaveRequests((current) =>
        current.map((row) =>
          row.id === requestId
            ? {
                ...row,
                status: decision,
                reviewedAt: new Date().toISOString(),
                reviewNote,
              }
            : row,
        ),
      );
      setSelectedLeave((current) =>
        current?.id === requestId
          ? {
              ...current,
              status: decision,
              reviewedAt: new Date().toISOString(),
              reviewNote,
            }
          : current,
      );
    },
    [],
  );

  const hoursToolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setHoursSearch("");
        setHoursStatusFilter("all");
        hoursPagination.setPage(1);
      }}
      clearDisabled={hoursSearch.trim() === "" && hoursStatusFilter === "all"}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={hoursSearch}
          onChange={(value) => {
            setHoursSearch(value);
            hoursPagination.setPage(1);
          }}
          placeholder="Search working hours…"
          aria-label="Search working hours"
        />
      }
    >
      <StatusFilterSelect
        label="Status"
        value={hoursStatusFilter}
        options={WORK_DAY_STATUS_OPTIONS}
        onValueChange={(value) => {
          setHoursStatusFilter(value);
          hoursPagination.setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const weeklyHoursTable = wrapDistributorTableBody(
    <Table aria-label="Weekly working hours" className="min-w-[var(--table-min-width-md)]">
      <Table.Header>
        <Table.Head id="day" label="Day" isRowHeader />
        <Table.Head id="hours" label="Hours" className="text-right [&>div]:justify-end" />
        <Table.Head id="status" label="Status" />
      </Table.Header>
      <Table.Body items={hoursPagination.pageItems}>
        {(row: DistributorJobWorkDay) => (
          <Table.Row id={row.day}>
            <Table.Cell className="font-medium">{row.day}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">
              {row.hours > 0 ? `${row.hours.toFixed(1)}h` : "—"}
            </Table.Cell>
            <Table.Cell>
              <StatusBadge variant={workDayStatusVariant(row.status)}>
                {workDayStatusLabel(row.status)}
              </StatusBadge>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  const attendanceToolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setAttendanceSearch("");
        setAttendanceWorkTypeFilter("all");
        setAttendanceStatusFilter("all");
        attendancePagination.setPage(1);
      }}
      clearDisabled={
        attendanceSearch.trim() === "" &&
        attendanceWorkTypeFilter === "all" &&
        attendanceStatusFilter === "all"
      }
      search={
        <DistributorTableSearchCard
          variant="card"
          value={attendanceSearch}
          onChange={(value) => {
            setAttendanceSearch(value);
            attendancePagination.setPage(1);
          }}
          placeholder="Search attendance log…"
          aria-label="Search attendance log"
        />
      }
    >
      <StatusFilterSelect
        label="Location"
        value={attendanceWorkTypeFilter}
        options={WORK_TYPE_OPTIONS}
        onValueChange={(value) => {
          setAttendanceWorkTypeFilter(value);
          attendancePagination.setPage(1);
        }}
      />
      <StatusFilterSelect
        label="Status"
        value={attendanceStatusFilter}
        options={ATTENDANCE_STATUS_OPTIONS}
        onValueChange={(value) => {
          setAttendanceStatusFilter(value);
          attendancePagination.setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const attendanceTable = wrapDistributorTableBody(
    <Table
      aria-label="Detailed work attendance"
      className="min-w-[var(--table-min-width-2xl)]"
      sortDescriptor={attendanceSort}
      onSortChange={(descriptor) => {
        setAttendanceSort(descriptor);
        attendancePagination.setPage(1);
      }}
      pagination={attendancePagination.pagination}
    >
      <Table.Header>
        <Table.Head id="date" label="Date" isRowHeader allowsSorting />
        <Table.Head id="clockIn" label="Clock in" allowsSorting />
        <Table.Head id="clockOut" label="Clock out" allowsSorting />
        <Table.Head id="hours" label="Hours" allowsSorting className="text-right [&>div]:justify-end" />
        <Table.Head id="workType" label="Location" allowsSorting />
        <Table.Head id="payFactor" label="Pay factor" allowsSorting className="text-right [&>div]:justify-end" />
        <Table.Head id="status" label="Status" allowsSorting />
      </Table.Header>
      <Table.Body items={attendancePagination.pageItems}>
        {(row: DistributorWorkAttendanceRow) => {
          const statusLabel = attendanceStatusLabel(row);
          return (
            <Table.Row id={row.id}>
              <Table.Cell>
                <p className="font-medium">{formatDistributorDate(row.date)}</p>
                {statusLabel ? (
                  <p className="text-caption text-muted-foreground">{statusLabel}</p>
                ) : null}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted-foreground">
                {formatClockTime(row.clockIn)}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted-foreground">
                {formatClockTime(row.clockOut)}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums">
                {row.hours > 0 ? `${row.hours.toFixed(1)}h` : "—"}
              </Table.Cell>
              <Table.Cell>
                {row.workType ? (
                  <StatusBadge variant={workTypeVariant(row.workType)}>
                    {row.workType}
                  </StatusBadge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums">
                {row.payFactor > 0 ? `${row.payFactor.toFixed(2)}×` : "—"}
              </Table.Cell>
              <Table.Cell>
                {row.status === "complete" ? (
                  <StatusBadge variant="success">Complete</StatusBadge>
                ) : row.status === "partial" ? (
                  <StatusBadge variant="warning">Partial</StatusBadge>
                ) : row.status === "leave" ? (
                  <StatusBadge variant="info">Leave</StatusBadge>
                ) : (
                  <StatusBadge variant="neutral">Holiday</StatusBadge>
                )}
              </Table.Cell>
            </Table.Row>
          );
        }}
      </Table.Body>
    </Table>,
  );

  const leaveToolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setLeaveSearch("");
        setLeaveStatusFilter("all");
        setLeaveTypeFilter("all");
        leavePagination.setPage(1);
      }}
      clearDisabled={
        leaveSearch.trim() === "" && leaveStatusFilter === "all" && leaveTypeFilter === "all"
      }
      search={
        <DistributorTableSearchCard
          variant="card"
          value={leaveSearch}
          onChange={(value) => {
            setLeaveSearch(value);
            leavePagination.setPage(1);
          }}
          placeholder="Search leave applications…"
          aria-label="Search leave applications"
        />
      }
    >
      <StatusFilterSelect
        label="Leave type"
        value={leaveTypeFilter}
        options={LEAVE_TYPE_OPTIONS}
        onValueChange={(value) => {
          setLeaveTypeFilter(value);
          leavePagination.setPage(1);
        }}
      />
      <StatusFilterSelect
        label="Status"
        value={leaveStatusFilter}
        options={LEAVE_REQUEST_STATUS_OPTIONS}
        onValueChange={(value) => {
          setLeaveStatusFilter(value);
          leavePagination.setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const leaveTable = wrapDistributorTableBody(
    <Table
      aria-label="Leave applications"
      className="min-w-[var(--table-min-width-2xl)]"
      sortDescriptor={leaveSort}
      onSortChange={(descriptor) => {
        setLeaveSort(descriptor);
        leavePagination.setPage(1);
      }}
      pagination={leavePagination.pagination}
    >
      <Table.Header>
        <Table.Head id="type" label="Type" isRowHeader allowsSorting />
        <Table.Head id="fromDate" label="From" allowsSorting />
        <Table.Head id="toDate" label="To" allowsSorting />
        <Table.Head id="days" label="Days" allowsSorting className="text-right [&>div]:justify-end" />
        <Table.Head id="appliedAt" label="Submitted" allowsSorting />
        <Table.Head id="status" label="Status" allowsSorting />
        <Table.Head id="reason" label="Reason" allowsSorting />
      </Table.Header>
      <Table.Body items={leavePagination.pageItems}>
        {(row: DistributorLeaveRequest) => (
          <Table.Row
            id={row.id}
            onAction={() => openLeaveDialog(row)}
            className="cursor-pointer"
          >
            <Table.Cell className="font-medium">{row.type}</Table.Cell>
            <Table.Cell>{formatDistributorDate(row.fromDate)}</Table.Cell>
            <Table.Cell>{formatDistributorDate(row.toDate)}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{row.days}</Table.Cell>
            <Table.Cell>{formatDistributorDate(row.appliedAt)}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={leaveStatusVariant(row.status)}>
                {getLeaveRequestStatusLabel(row.status)}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell className="max-w-[14rem] text-muted-foreground">{row.reason}</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={cn("space-y-4", className)}>
      <BranchDistributorSquareCardGrid columns={4}>
        <BranchDistributorSquareMetricCard
          icon={IndianRupee}
          label="Take-home (MTD)"
          value={formatPortfolioMetricAmount(snapshot.compensation.takeHome)}
          hint={snapshot.compensation.periodLabel}
          tone="accent"
        />
        <BranchDistributorSquareMetricCard
          icon={Briefcase}
          label="Incentive (MTD)"
          value={formatPortfolioMetricAmount(snapshot.performance.finalIncentive)}
          hint={`${snapshot.performance.achievementPct}% of target`}
        />
        <BranchDistributorSquareMetricCard
          icon={Clock3}
          label="Hours this week"
          value={`${snapshot.workHours.totalHours}h`}
          hint={`Target ${snapshot.workHours.targetHours}h · OT ${snapshot.workHours.overtimeHours}h`}
        />
        <BranchDistributorSquareMetricCard
          icon={CalendarClock}
          label="Leave pending"
          value={String(leavePendingCount)}
          hint={`${snapshot.workHours.avgDailyHours.toFixed(1)}h avg/day`}
          tone="soft"
        />
      </BranchDistributorSquareCardGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-border bg-card p-4 shadow-sm">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Payroll snapshot
          </p>
          <dl className="mt-3 grid gap-2 text-compact">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Basic salary</dt>
              <dd className="font-medium tabular-nums">
                {formatPortfolioMetricAmount(snapshot.compensation.basicSalary)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Performance incentive</dt>
              <dd className="font-medium tabular-nums">
                {formatPortfolioMetricAmount(snapshot.compensation.performanceIncentive)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Spot bonus</dt>
              <dd className="font-medium tabular-nums">
                {formatPortfolioMetricAmount(snapshot.compensation.spotBonus)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
              <dt className="font-medium">Net payable</dt>
              <dd className="font-semibold tabular-nums">
                {formatPortfolioMetricAmount(snapshot.compensation.takeHome)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="overflow-hidden border-border bg-card p-4 shadow-sm">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Commission (MTD)
          </p>
          {commissionRow ? (
            <dl className="mt-3 grid gap-2 text-compact">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Accrued</dt>
                <dd className="font-medium tabular-nums">{formatAum(commissionRow.accrued)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Released</dt>
                <dd className="font-medium tabular-nums">{formatAum(commissionRow.released)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">On hold</dt>
                <dd className="font-medium tabular-nums">{formatAum(commissionRow.onHold)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                <dt className="font-medium">Payout status</dt>
                <dd>
                  <StatusBadge
                    variant={
                      commissionRow.payoutStatus === "Paid"
                        ? "success"
                        : commissionRow.payoutStatus === "On hold"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {commissionRow.payoutStatus}
                  </StatusBadge>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-compact text-muted-foreground">
              {ZYND_MITRA_COPY.noCommissionData}
            </p>
          )}
        </Card>
      </div>

      <div className="distributor-branch-distributor-work-subtabs">
        <DistributorPageHeader
          title={BRANCH_DISTRIBUTOR_WORK_SUB_TAB_LABELS[activeSubTab]}
          titleAs="h3"
          titleSwitchKey={activeSubTab}
          titleClassName="text-caption font-medium uppercase tracking-wide text-muted-foreground"
          className="distributor-client-activity-tab__subheader"
        >
          <BranchDistributorWorkSubTabs
            value={activeSubTab}
            onChange={onSubTabChange}
            busy={isSubTabPending}
          />
        </DistributorPageHeader>

        <div
          key={activeSubTab}
          role="tabpanel"
          id={`branch-distributor-work-sub-panel-${activeSubTab}`}
          aria-labelledby={`branch-distributor-work-sub-tab-${activeSubTab}`}
          className={cn(
            "distributor-client-activity-tab__panel distributor-client-activity-tab__panel--enter space-y-3",
            isSubTabPending && "distributor-client-activity-tab__panel--pending",
          )}
        >
          {activeSubTab === "hours" ? (
            <>
              <WorkSubTabMetricCards metrics={hoursMetrics} />
              <DistributorTableOnlyShell
                toolbar={hoursToolbar}
                isEmpty={hoursPagination.pageItems.length === 0}
                emptyTitle="No working hours match"
                emptyDescription="Adjust status filter or search."
              >
                {weeklyHoursTable}
              </DistributorTableOnlyShell>
            </>
          ) : null}

          {activeSubTab === "attendance" ? (
            <>
              <WorkSubTabMetricCards metrics={attendanceMetrics} />
              <DistributorTableOnlyShell
                toolbar={attendanceToolbar}
                isEmpty={attendancePagination.pageItems.length === 0}
                emptyTitle="No attendance records match"
                emptyDescription="Try adjusting search."
              >
                {attendanceTable}
              </DistributorTableOnlyShell>
            </>
          ) : null}

          {activeSubTab === "leave" ? (
            <>
              <WorkSubTabMetricCards metrics={leaveMetrics} />
              <DistributorTableOnlyShell
                toolbar={leaveToolbar}
                isEmpty={leavePagination.pageItems.length === 0}
                emptyTitle="No leave applications match"
                emptyDescription="Adjust status filter or search."
              >
                {leaveTable}
              </DistributorTableOnlyShell>
            </>
          ) : null}
        </div>
      </div>

      <BranchDistributorLeaveReviewDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        profile={profile}
        request={selectedLeave}
        balances={snapshot.leaveBalances}
        onReview={handleLeaveReview}
      />
    </div>
  );
}
