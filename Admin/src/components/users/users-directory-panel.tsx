"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { RefreshCw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AdminUserProfileAvatar } from "@/components/users/admin-user-profile-avatar";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { useAdminUsersDirectoryQuery } from "@/hooks/use-admin-users-directory-query";
import { clientIdToProfilePath } from "@/lib/admin-user-ref";
import { cn } from "@/lib/utils";
import {
  InvestmentStatusBadge,
  KycComplianceBadge,
  MfaStatusBadge,
  PlatformRoleBadge,
  UserStatusBadge,
} from "@/components/users/user-status-badge";

const ALL = "all";
const USER_CELL_CLASS = "w-[15rem] max-w-[15rem] overflow-hidden";
const ZYND_ID_CELL_CLASS = "w-[10rem] max-w-[10rem] overflow-hidden";

const STATUS_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "pending", label: "Pending" },
];

const ROLE_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All roles" },
  { value: "user", label: "Customer" },
  { value: "admin", label: "Admin" },
];

const INVESTMENT_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All investors" },
  { value: "invested", label: "Invested" },
  { value: "not_invested", label: "Not invested" },
];

type UsersDirectoryPanelProps = Record<string, never>;

export function UsersDirectoryPanel(_props: UsersDirectoryPanelProps) {
  const router = useRouter();
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [investmentFilter, setInvestmentFilter] = useState(ALL);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const { data, isLoading, isFetching, error, refetch } = useAdminUsersDirectoryQuery({
    emailFilter,
    statusFilter,
    roleFilter,
    investmentFilter,
    offset,
    pageSize,
  });

  const users = data?.users ?? [];
  const hasMore = data?.hasMore ?? false;
  const showSkeleton = isLoading && users.length === 0;
  const errorMessage = error ? getErrorMessage(error, "Could not load users.") : "";

  const handleSearch = () => {
    if (offset === 0) {
      void refetch();
      return;
    }
    setOffset(0);
  };

  const handleOpenProfile = (user: (typeof users)[number]) => {
    router.push(`/dashboard/users/${clientIdToProfilePath(user.client_id)}/portfolio`);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setOffset(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
          placeholder="Search by email"
          value={emailFilter}
          onChange={(event) => setEmailFilter(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSearch();
          }}
        />

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AdminSelect
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setOffset(0);
            }}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Status"
            className="min-w-select-sm"
            triggerClassName="w-auto"
          />

          <AdminSelect
            value={roleFilter}
            onValueChange={(value) => {
              setRoleFilter(value);
              setOffset(0);
            }}
            options={ROLE_FILTER_OPTIONS}
            placeholder="Role"
            className="min-w-select-sm"
            triggerClassName="w-auto"
          />

          <AdminSelect
            value={investmentFilter}
            onValueChange={(value) => {
              setInvestmentFilter(value);
              setOffset(0);
            }}
            options={INVESTMENT_FILTER_OPTIONS}
            placeholder="Investment"
            className="min-w-select-md"
            triggerClassName="w-auto"
          />

          <Button
            variant="outline"
            size="icon"
            onClick={() => void refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

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
              disabled={isFetching && users.length === 0}
              currentPageCount={users.length}
              hasMore={hasMore}
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
              onPrevious={() => setOffset((value) => Math.max(0, value - pageSize))}
              onNext={() => setOffset((value) => value + pageSize)}
            />
          }
        >
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell className={USER_CELL_CLASS}>User</AdminTableHeadCell>
              <AdminTableHeadCell className={ZYND_ID_CELL_CLASS}>Zynd ID</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
              <AdminTableHeadCell>Role</AdminTableHeadCell>
              <AdminTableHeadCell>Invested</AdminTableHeadCell>
              <AdminTableHeadCell className="text-center">KYC</AdminTableHeadCell>
              <AdminTableHeadCell>MFA</AdminTableHeadCell>
              <AdminTableHeadCell>Joined</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {showSkeleton ? (
              <AdminTableSkeletonRows columns={8} />
            ) : users.length === 0 ? (
              <AdminTableStateRow colSpan={8}>No users match your filters.</AdminTableStateRow>
            ) : (
              users.map((user) => (
                <AdminTableRow key={user.user_id} onClick={() => handleOpenProfile(user)}>
                      <AdminTableCell className={USER_CELL_CLASS}>
                        <div className="flex min-w-0 items-center gap-3">
                          <AdminUserProfileAvatar
                            name={user.display_name}
                            email={user.email}
                            imageSrc={user.profile_image_url}
                            size="md"
                            className="shrink-0"
                          />
                          <div className="min-w-0">
                            <span
                              className="block truncate text-compact text-foreground"
                              title={user.email}
                            >
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell className={cn("text-muted-foreground", ZYND_ID_CELL_CLASS)}>
                        <span className="block truncate font-mono text-compact" title={user.client_id}>
                          {user.client_id}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <UserStatusBadge status={user.status} />
                      </AdminTableCell>
                      <AdminTableCell>
                        <PlatformRoleBadge role={user.role} />
                      </AdminTableCell>
                      <AdminTableCell>
                        <InvestmentStatusBadge hasInvested={user.has_invested} />
                      </AdminTableCell>
                      <AdminTableCell className="text-center">
                        <div className="flex justify-center">
                          <KycComplianceBadge compliant={user.kyc_compliant} />
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <MfaStatusBadge enabled={user.mfa_enrolled} />
                      </AdminTableCell>
                      <AdminTableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </AdminTableCell>
                    </AdminTableRow>
                ))
              )}
          </AdminTableBody>
        </AdminDataTable>
    </div>
  );
}
