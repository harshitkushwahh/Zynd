import type { DistributorWorkAttendanceRow, DistributorWorkLocationType } from "@/lib/distributor-job-dashboard-data";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

export const WORK_TYPE_OPTIONS: Array<{ value: DistributorWorkLocationType; label: string }> = [
  { value: "Office", label: "Office" },
  { value: "Client site", label: "Client site" },
  { value: "Home", label: "Home" },
];

export function formatClockTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
    .format(new Date(iso))
    .replace(/\s?(AM|PM)$/i, (match) => ` ${match.trim().toLowerCase()}`);
}

export function workTypeVariant(workType: DistributorWorkLocationType | null): StatusBadgeVariant {
  if (workType === "Client site") return "info";
  if (workType === "Home") return "success";
  return "neutral";
}

export function attendanceStatusLabel(row: DistributorWorkAttendanceRow): string | null {
  if (row.status === "leave") return "Leave";
  if (row.status === "holiday") return "Holiday";
  if (row.status === "partial") return "Half day";
  return null;
}
