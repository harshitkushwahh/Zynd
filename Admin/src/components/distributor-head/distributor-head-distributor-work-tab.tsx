"use client";

import { Clock3, MapPin } from "lucide-react";

import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import type {
  DistributorHeadWorkAttendanceRow,
  DistributorHeadWorkHours,
} from "@/lib/dummy/distributor-head-data";

const TABLE_COLUMNS = 6;

function attendanceStatusVariant(status: DistributorHeadWorkAttendanceRow["status"]) {
  if (status === "complete") return "success" as const;
  if (status === "partial") return "warning" as const;
  if (status === "leave") return "info" as const;
  return "neutral" as const;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function DistributorHeadDistributorWorkTab({
  workHours,
  attendance,
}: {
  workHours: DistributorHeadWorkHours | undefined;
  attendance: DistributorHeadWorkAttendanceRow[];
}) {
  return (
    <div className="space-y-6">
      {workHours ? (
        <AdminMetricCardsGrid>
          <AdminMetricCard
            icon={Clock3}
            label="Hours this week"
            value={`${workHours.totalHours}h`}
            hint={`Target ${workHours.targetHours}h · ${workHours.weekLabel}`}
            tone="success"
            accent
          />
          <AdminMetricCard
            icon={Clock3}
            label="Avg daily hours"
            value={`${workHours.avgDailyHours}h`}
            hint={`${workHours.trendPct >= 0 ? "+" : ""}${workHours.trendPct}% vs last week`}
            tone="info"
          />
          <AdminMetricCard
            icon={Clock3}
            label="Overtime"
            value={`${workHours.overtimeHours}h`}
            hint="Beyond standard week"
            tone="default"
          />
        </AdminMetricCardsGrid>
      ) : (
        <p className="text-compact text-muted-foreground">
          No working-hours summary for this distributor in demo data.
        </p>
      )}

      <AdminDataTable minWidth="4xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Date</AdminTableHeadCell>
            <AdminTableHeadCell>Clock in</AdminTableHeadCell>
            <AdminTableHeadCell>Clock out</AdminTableHeadCell>
            <AdminTableHeadCell>Hours</AdminTableHeadCell>
            <AdminTableHeadCell>Location</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {attendance.length === 0 ? (
            <AdminTableStateRow colSpan={TABLE_COLUMNS}>
              No attendance records for this week.
            </AdminTableStateRow>
          ) : (
            attendance.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="font-medium">{formatDate(row.date)}</AdminTableCell>
                <AdminTableCell className="tabular-nums">{row.clockIn ?? "—"}</AdminTableCell>
                <AdminTableCell className="tabular-nums">{row.clockOut ?? "—"}</AdminTableCell>
                <AdminTableCell className="tabular-nums">{row.hours > 0 ? `${row.hours}h` : "—"}</AdminTableCell>
                <AdminTableCell>
                  {row.workType ? (
                    <span className="inline-flex items-center gap-1 text-compact">
                      <MapPin className="size-3 text-muted-foreground" />
                      {row.workType}
                    </span>
                  ) : (
                    "—"
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={attendanceStatusVariant(row.status)} showIcon={false}>
                    {row.status}
                  </StatusBadge>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
