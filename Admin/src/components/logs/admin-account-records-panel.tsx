"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ArrowUpRight } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
  getOffsetPage,
} from "@/components/ui/admin-table";
import { AdminUserProfileAvatar } from "@/components/users/admin-user-profile-avatar";
import {
  MfaStatusBadge,
  PlatformRoleBadge,
  UserStatusBadge,
} from "@/components/users/user-status-badge";
import {
  adminAccountRecordsQueryKey,
  useAdminAccountRecordsQuery,
} from "@/hooks/use-admin-account-records-query";
import { usePlatformAdminUsersQuery } from "@/hooks/use-platform-admin-users-query";
import { type AuditLogItem } from "@/lib/admin-api";
import {
  ADMIN_ACCOUNT_JOURNEY_EVENT_TYPES,
  formatAuditEvent,
} from "@/lib/admin-audit-events";
import { pickUserRef, displayZyndId, userDashboardProfileHref } from "@/lib/admin-user-ref";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestampDetail } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const ALL = "all";

const EVENT_TYPE_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All admin events" },
  ...ADMIN_ACCOUNT_JOURNEY_EVENT_TYPES.map((eventType) => ({
    value: eventType,
    label: formatAuditEvent(eventType),
  })),
];

function matchesSearch(log: AuditLogItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    formatAuditEvent(log.event_type, log.metadata),
    log.event_type,
    log.user_email ?? "",
    log.client_id ?? "",
    log.ip_address ?? "",
    formatTimestampDetail(log.created_at),
    JSON.stringify(log.metadata ?? {}),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

type AdminAccountRecordsPanelProps = {
  initialUserRef?: string;
  embedded?: boolean;
};

export function AdminAccountRecordsPanel({
  initialUserRef,
  embedded = false,
}: AdminAccountRecordsPanelProps) {
  const queryClient = useQueryClient();
  const { data: platformAdmins = [], isPending: adminsLoading } = usePlatformAdminUsersQuery(!embedded);
  const [selectedUserRef, setSelectedUserRef] = useState(initialUserRef ?? "");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState(ALL);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  useEffect(() => {
    if (initialUserRef) {
      setSelectedUserRef(initialUserRef);
    }
  }, [initialUserRef]);

  useEffect(() => {
    if (embedded || selectedUserRef || adminsLoading || platformAdmins.length === 0) return;
    setSelectedUserRef(pickUserRef(platformAdmins[0] ?? {}));
  }, [adminsLoading, embedded, platformAdmins, selectedUserRef]);

  const adminOptions = useMemo<AdminSelectOption[]>(
    () =>
      platformAdmins.map((admin) => ({
        value: pickUserRef(admin),
        label: admin.email,
      })),
    [platformAdmins],
  );

  const selectedAdmin = useMemo(
    () => platformAdmins.find((admin) => pickUserRef(admin) === selectedUserRef) ?? null,
    [platformAdmins, selectedUserRef],
  );

  const queryParams = {
    userRef: selectedUserRef,
    eventFilter,
    offset,
    pageSize,
  };
  const { data, isPending, isFetching, error } = useAdminAccountRecordsQuery(queryParams);
  const logs = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;
  const showSkeleton = isPending && !data;
  const errorMessage = error ? getErrorMessage(error, "Could not load admin account records.") : "";

  useEffect(() => {
    setOffset(0);
  }, [eventFilter, pageSize, selectedUserRef]);

  const filteredLogs = useMemo(
    () => logs.filter((log) => matchesSearch(log, search)),
    [logs, search],
  );

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminAccountRecordsQueryKey(queryParams) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {!embedded ? (
            <AdminSelect
              value={selectedUserRef}
              onValueChange={setSelectedUserRef}
              options={adminOptions}
              placeholder={adminsLoading ? "Loading admins…" : "Select platform admin"}
              disabled={adminsLoading || adminOptions.length === 0}
              size="default"
              className="min-w-select-xl max-w-md shrink-0"
              triggerClassName="w-auto min-w-select-xl"
            />
          ) : null}
          <AdminSearchInput
            containerClassName="min-w-0 flex-1 sm:min-w-[14rem] sm:flex-none"
            placeholder="Search event, IP, or details"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={!selectedUserRef}
            aria-label="Refresh admin account records"
            className="shrink-0"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
          <AdminSelect
            value={eventFilter}
            onValueChange={setEventFilter}
            options={EVENT_TYPE_OPTIONS}
            placeholder="Event type"
            className="min-w-select-xl shrink-0"
            triggerClassName="w-auto"
          />
          <StatusBadge variant="info" showIcon={false}>
            {filteredLogs.length.toLocaleString()} shown
          </StatusBadge>
        </div>
      </div>

      {!embedded && selectedAdmin ? (
        <div className="admin-account-record-identity">
          <div className="admin-account-record-identity__main">
            <AdminUserProfileAvatar
              name={selectedAdmin.display_name}
              email={selectedAdmin.email}
              imageSrc={selectedAdmin.profile_image_url}
              size="lg"
              className="shrink-0"
            />
            <div className="admin-account-record-identity__contact min-w-0">
              <p className="admin-account-record-identity__name truncate">
                {selectedAdmin.display_name}
              </p>
              <p className="admin-account-record-identity__email truncate">
                {selectedAdmin.email}
              </p>
              <p className="admin-account-record-identity__client-id truncate">
                {displayZyndId(selectedAdmin.client_id)}
              </p>
            </div>
          </div>
          <div className="admin-account-record-identity__aside">
            <div className="admin-account-record-identity__badges">
              <PlatformRoleBadge role={selectedAdmin.role} />
              <UserStatusBadge status={selectedAdmin.status} />
              <MfaStatusBadge enabled={selectedAdmin.mfa_enrolled} />
            </div>
            <Button
              nativeButton={false}
              render={
                <Link href={userDashboardProfileHref(pickUserRef(selectedAdmin), "overview")} />
              }
              variant="outline"
              size="icon"
              className="admin-account-record-identity__action shrink-0"
              aria-label="Open profile"
            >
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <AdminFeedbackMessage variant="destructive">{errorMessage}</AdminFeedbackMessage>
      ) : null}

      <AdminDataTable
        minWidth="5xl"
        footer={
          <AdminTablePagination
            page={getOffsetPage(offset, pageSize)}
            hasPrevious={offset > 0}
            hasNext={hasMore}
            disabled={isFetching || !selectedUserRef}
            currentPageCount={filteredLogs.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setOffset(0);
            }}
            onPrevious={() => setOffset((value) => Math.max(0, value - pageSize))}
            onNext={() => setOffset((value) => value + pageSize)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Time</AdminTableHeadCell>
            <AdminTableHeadCell>Event</AdminTableHeadCell>
            <AdminTableHeadCell>IP address</AdminTableHeadCell>
            <AdminTableHeadCell>Details</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {!selectedUserRef ? (
            <AdminTableStateRow colSpan={4}>
              Select a platform admin to view their admin dashboard journey.
            </AdminTableStateRow>
          ) : showSkeleton ? (
            <AdminTableSkeletonRows columns={4} />
          ) : filteredLogs.length === 0 ? (
            <AdminTableStateRow colSpan={4}>
              No admin dashboard activity matches your filters.
            </AdminTableStateRow>
          ) : (
            filteredLogs.map((log) => (
              <AdminTableRow key={log.id}>
                <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                  {formatTimestampDetail(log.created_at)}
                </AdminTableCell>
                <AdminTableCell>
                  <p className="font-medium text-foreground">
                    {formatAuditEvent(log.event_type, log.metadata)}
                  </p>
                  <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                    {log.event_type}
                  </p>
                  {log.event_type === "admin_action_requested" &&
                  typeof log.metadata?.module === "string" ? (
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      Module: {String(log.metadata.module).replaceAll("_", " ")}
                    </p>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {log.ip_address ?? "—"}
                </AdminTableCell>
                <AdminTableCell className="max-w-sm">
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-caption text-muted-foreground">
                    {Object.keys(log.metadata ?? {}).length
                      ? JSON.stringify(log.metadata, null, 0)
                      : "—"}
                  </pre>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
