"use client";

import { useMemo, useState } from "react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { Badge } from "@/components/ui/badge";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import type { DistributorHeadLeaveApplication } from "@/lib/dummy/distributor-head-data";

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

const LEAVE_TABLE_COLUMNS = 6;

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

  return (
    <AdminDataTable minWidth="5xl">
      <AdminTableHeader>
        <tr>
          <AdminTableHeadCell>Applicant</AdminTableHeadCell>
          <AdminTableHeadCell>Branch</AdminTableHeadCell>
          <AdminTableHeadCell>Leave</AdminTableHeadCell>
          <AdminTableHeadCell>Dates</AdminTableHeadCell>
          <AdminTableHeadCell>Status</AdminTableHeadCell>
          <AdminTableHeadCell>Submitted</AdminTableHeadCell>
        </tr>
      </AdminTableHeader>
      <AdminTableBody>
        {sorted.length === 0 ? (
          <AdminTableStateRow colSpan={LEAVE_TABLE_COLUMNS}>{emptyMessage}</AdminTableStateRow>
        ) : (
          sorted.map((item) => (
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
                <span className="block text-caption">
                  {item.days} day{item.days === 1 ? "" : "s"}
                </span>
              </AdminTableCell>
              <AdminTableCell>
                <DistributorHeadStatusBadge status={item.status} />
              </AdminTableCell>
              <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                {formatSubmittedAt(item.submittedAt)}
              </AdminTableCell>
            </AdminTableRow>
          ))
        )}
      </AdminTableBody>
    </AdminDataTable>
  );
}

const LEAVE_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

type LeavePaneKey = "manager" | "team";

export function DistributorHeadManagerLeaveTab({
  managerLeave,
  teamLeave,
}: {
  managerLeave: DistributorHeadLeaveApplication[];
  teamLeave: DistributorHeadLeaveApplication[];
}) {
  const [activePane, setActivePane] = useState<LeavePaneKey>("manager");
  const [managerSearch, setManagerSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");

  const filteredManagerLeave = useMemo(() => {
    return managerLeave.filter((row) => {
      if (managerFilter !== "all" && row.status !== managerFilter) return false;
      return matchesLeaveSearch(row, managerSearch);
    });
  }, [managerFilter, managerLeave, managerSearch]);

  const filteredTeamLeave = useMemo(() => {
    return teamLeave.filter((row) => {
      if (teamFilter !== "all" && row.status !== teamFilter) return false;
      return matchesLeaveSearch(row, teamSearch);
    });
  }, [teamFilter, teamLeave, teamSearch]);

  const isManagerPane = activePane === "manager";
  const search = isManagerPane ? managerSearch : teamSearch;
  const setSearch = isManagerPane ? setManagerSearch : setTeamSearch;
  const statusFilter = isManagerPane ? managerFilter : teamFilter;
  const setStatusFilter = isManagerPane ? setManagerFilter : setTeamFilter;
  const pendingCount = (isManagerPane ? managerLeave : teamLeave).filter(
    (row) => row.status === "Pending",
  ).length;

  const managerEmpty =
    managerSearch.trim() || managerFilter !== "all"
      ? "No manager leave requests match your search or filters."
      : "No manager leave requests on record.";
  const teamEmpty =
    teamSearch.trim() || teamFilter !== "all"
      ? "No team leave requests match your search or filters."
      : `No ${MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()} leave requests for this team.`;

  return (
    <Tabs
      value={activePane}
      onValueChange={(value) => {
        if (value === "manager" || value === "team") setActivePane(value);
      }}
      className="gap-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:min-w-[14rem]"
          placeholder="Search by name, branch, or leave type"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <AdminSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={LEAVE_FILTER_OPTIONS}
            placeholder="Status"
            className="min-w-select-sm shrink-0 self-end sm:self-auto"
            triggerClassName="w-auto"
            aria-label="Filter leave by status"
          />

          <AdminTabList variant="secondary" className="max-w-full overflow-x-auto">
            <AdminTabTrigger value="manager" className="gap-2">
              Manager leave
              <Badge variant="secondary" className="h-5 px-1.5 tabular-nums font-normal">
                {managerLeave.length}
              </Badge>
            </AdminTabTrigger>
            <AdminTabTrigger value="team" className="gap-2">
              Team leave
              <Badge variant="secondary" className="h-5 px-1.5 tabular-nums font-normal">
                {teamLeave.length}
              </Badge>
            </AdminTabTrigger>
          </AdminTabList>

          {pendingCount > 0 ? (
            <Badge className="w-fit shrink-0 tabular-nums">{pendingCount} pending</Badge>
          ) : null}
        </div>
      </div>

      <TabsContent value="manager" keepMounted className="mt-0">
        <LeaveList items={filteredManagerLeave} emptyMessage={managerEmpty} />
      </TabsContent>

      <TabsContent value="team" keepMounted className="mt-0">
        <LeaveList items={filteredTeamLeave} emptyMessage={teamEmpty} />
      </TabsContent>
    </Tabs>
  );
}
