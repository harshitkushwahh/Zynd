"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import type { DistributorHeadLeaveApplication } from "@/lib/dummy/distributor-head-data";
import { cn } from "@/lib/utils";

const LEAVE_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: "all", label: "All statuses" },
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

export function DistributorHeadDistributorLeaveTab({
  leaveItems,
}: {
  leaveItems: DistributorHeadLeaveApplication[];
}) {
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return leaveItems;
    return leaveItems.filter((row) => row.status === statusFilter);
  }, [leaveItems, statusFilter]);

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "Pending" && b.status !== "Pending") return -1;
    if (a.status !== "Pending" && b.status === "Pending") return 1;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  const pendingCount = leaveItems.filter((row) => row.status === "Pending").length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarDays className="size-4 text-primary" />
              Leave history
            </CardTitle>
            <p className="mt-1 text-caption text-muted-foreground">
              Read-only — distributor leave is approved by the branch manager
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 ? (
              <Badge className="tabular-nums">{pendingCount} pending</Badge>
            ) : null}
            <AdminSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={LEAVE_FILTER_OPTIONS}
              placeholder="Status"
              className="min-w-select-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {sorted.length === 0 ? (
          <p className="text-compact text-muted-foreground">No leave requests on record.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "py-3 first:pt-0 last:pb-0",
                  item.status === "Pending" && "bg-warning/5 -mx-4 rounded-md px-4",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{item.leaveType}</p>
                    <Badge variant="outline" className="mt-1 h-5 font-normal text-micro">
                      {item.branchName}
                    </Badge>
                  </div>
                  <DistributorHeadStatusBadge status={item.status} className="shrink-0" />
                </div>
                <p className="mt-2 text-caption text-muted-foreground">
                  {formatLeaveDate(item.startDate)} – {formatLeaveDate(item.endDate)} · {item.days}d ·{" "}
                  {item.city}
                </p>
                <p className="mt-1 text-caption text-muted-foreground">{item.reason}</p>
                <p className="mt-1 text-micro text-muted-foreground">
                  Submitted {formatSubmittedAt(item.submittedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
