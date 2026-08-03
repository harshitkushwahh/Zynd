"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import type { DistributorHeadLeaveApplication } from "@/lib/dummy/distributor-head-data";
import { cn } from "@/lib/utils";

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

function LeaveList({
  items,
  emptyMessage,
}: {
  items: DistributorHeadLeaveApplication[];
  emptyMessage: string;
}) {
  const sorted = [...items].sort((a, b) => {
    if (a.status === "Pending" && b.status !== "Pending") return -1;
    if (a.status !== "Pending" && b.status === "Pending") return 1;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  if (sorted.length === 0) {
    return <p className="text-compact text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {sorted.map((item) => (
        <li
          key={item.id}
          className={cn("py-3 first:pt-0 last:pb-0", item.status === "Pending" && "bg-warning/5 -mx-4 px-4 rounded-md")}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.applicantName}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="h-5 font-normal text-micro">
                  {item.applicantRole}
                </Badge>
                <Badge variant="outline" className="h-5 font-normal text-micro text-muted-foreground">
                  {item.branchName}
                </Badge>
              </div>
            </div>
            <DistributorHeadStatusBadge status={item.status} className="shrink-0" />
          </div>
          <p className="mt-2 text-compact font-medium">{item.leaveType}</p>
          <p className="mt-1 text-caption text-muted-foreground">
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
  );
}

const LEAVE_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

export function DistributorHeadManagerLeaveTab({
  managerLeave,
  teamLeave,
}: {
  managerLeave: DistributorHeadLeaveApplication[];
  teamLeave: DistributorHeadLeaveApplication[];
}) {
  const [managerFilter, setManagerFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");

  const filteredManagerLeave = useMemo(() => {
    if (managerFilter === "all") return managerLeave;
    return managerLeave.filter((row) => row.status === managerFilter);
  }, [managerFilter, managerLeave]);

  const filteredTeamLeave = useMemo(() => {
    if (teamFilter === "all") return teamLeave;
    return teamLeave.filter((row) => row.status === teamFilter);
  }, [teamFilter, teamLeave]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <CalendarDays className="size-4 text-primary" />
                Manager leave
              </CardTitle>
              <p className="mt-1 text-caption text-muted-foreground">
                Requests routed to the state head for approval
              </p>
            </div>
            <AdminSelect
              value={managerFilter}
              onValueChange={setManagerFilter}
              options={LEAVE_FILTER_OPTIONS}
              placeholder="Status"
              className="min-w-select-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <LeaveList
            items={filteredManagerLeave}
            emptyMessage="No manager leave requests on record."
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <CalendarDays className="size-4 text-muted-foreground" />
                Team leave
              </CardTitle>
              <p className="mt-1 text-caption text-muted-foreground">
                Distributor requests approved by this manager
              </p>
            </div>
            <AdminSelect
              value={teamFilter}
              onValueChange={setTeamFilter}
              options={LEAVE_FILTER_OPTIONS}
              placeholder="Status"
              className="min-w-select-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <LeaveList
            items={filteredTeamLeave}
            emptyMessage="No distributor leave requests for this team."
          />
        </CardContent>
      </Card>
    </div>
  );
}
