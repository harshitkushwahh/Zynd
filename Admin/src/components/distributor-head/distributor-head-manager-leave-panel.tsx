"use client";

import { CalendarDays, Inbox } from "lucide-react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DistributorHeadLeaveApplication } from "@/lib/dummy/distributor-head-data";
import { cn } from "@/lib/utils";

function formatLeaveRange(start: string, end: string, days: number) {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  return `${fmt(start)} – ${fmt(end)} · ${days}d`;
}

export function DistributorHeadManagerLeavePanel({
  items,
}: {
  items: DistributorHeadLeaveApplication[];
}) {
  const pendingCount = items.filter((row) => row.status === "Pending").length;
  const sorted = [...items].sort((a, b) => {
    if (a.status === "Pending" && b.status !== "Pending") return -1;
    if (a.status !== "Pending" && b.status === "Pending") return 1;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  return (
    <Card className="h-full overflow-hidden border border-border/80 ring-0">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Inbox className="size-4 text-primary" />
              Team leave
            </CardTitle>
            <p className="mt-1 text-caption text-muted-foreground">
              Manager & distributor requests in this book
            </p>
          </div>
          {pendingCount > 0 ? (
            <Badge className="shrink-0 tabular-nums">{pendingCount} pending</Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 font-normal">
              Up to date
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-compact text-muted-foreground">No leave requests for this team.</p>
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {sorted.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "px-4 py-3",
                  item.status === "Pending" && "bg-warning/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.applicantName}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                <p className="mt-2 text-compact font-medium text-foreground">{item.leaveType}</p>
                <p className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
                  <CalendarDays className="size-3.5 shrink-0 opacity-80" />
                  {formatLeaveRange(item.startDate, item.endDate, item.days)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
