"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from "@/components/ui/admin-dialog";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
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
  paginateItems,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  MfaStatusBadge,
  TeamRoleBadge,
  UserStatusBadge,
} from "@/components/users/user-status-badge";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  adminAdminAccountsQueryKey,
  useAdminAdminAccountsQuery,
} from "@/hooks/use-admin-admin-accounts-query";
import {
  cancelAdminAccountDeletion,
  holdAdminAccountAccess,
  removeAdminAccount,
  restoreAdminAccountAccess,
  type AdminAccountListItem,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/errors";
import {
  displayZyndId,
  pickUserRef,
} from "@/lib/admin-user-ref";
import {
  MITRA_MANAGER_ROLE_KEY,
  MITRA_ROLE_KEY,
  MITRA_STATE_HEAD_ROLE_KEY,
  MITRA_SUPER_HEAD_ROLE_KEY,
  SUPER_ADMIN_ROLE_KEY,
} from "@/lib/admin-role-display";
import { cn } from "@/lib/utils";

const ALL = "all";
const UNASSIGNED = "unassigned";

const ROLE_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All roles" },
  { value: SUPER_ADMIN_ROLE_KEY, label: "Super Admin" },
  { value: MITRA_SUPER_HEAD_ROLE_KEY, label: "Mitra Super Head" },
  { value: MITRA_STATE_HEAD_ROLE_KEY, label: "Mitra State Head" },
  { value: MITRA_MANAGER_ROLE_KEY, label: "Mitra Manager" },
  { value: MITRA_ROLE_KEY, label: "Mitra" },
  { value: UNASSIGNED, label: "No roles assigned" },
];

const STATUS_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "deletion_pending", label: "Deletion pending" },
];

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function matchesSearchQuery(query: string, ...values: Array<string | null | undefined>) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => (value ?? "").toLowerCase().includes(normalized));
}

function matchesRoleFilter(filter: string, roles: string[]) {
  if (filter === ALL) return true;
  if (filter === UNASSIGNED) return roles.length === 0;
  return roles.includes(filter);
}

function matchesStatusFilter(filter: string, status: string) {
  if (filter === ALL) return true;
  return status === filter;
}

type AdminAccountsPanelProps = {
  enabled?: boolean;
};

export function AdminAccountsPanel({ enabled = true }: AdminAccountsPanelProps) {
  const queryClient = useQueryClient();
  const { user: currentUser, hasRole } = useAdminAuth();
  const isSuperAdmin = hasRole(SUPER_ADMIN_ROLE_KEY);
  const { data: accounts = [], isLoading, isFetching, refetch } = useAdminAdminAccountsQuery(enabled);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [holdTarget, setHoldTarget] = useState<AdminAccountListItem | null>(null);
  const [holdNotes, setHoldNotes] = useState("");
  const [removeTarget, setRemoveTarget] = useState<AdminAccountListItem | null>(null);

  const filteredAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          matchesRoleFilter(roleFilter, account.roles) &&
          matchesStatusFilter(statusFilter, account.status) &&
          matchesSearchQuery(
            searchQuery,
          account.email,
          account.display_name,
          account.client_id,
          account.user_ref,
          account.status,
            account.suspension_reason_code,
            ...account.roles,
          ),
      ),
    [accounts, roleFilter, searchQuery, statusFilter],
  );

  const pagination = paginateItems(filteredAccounts, page, pageSize);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: adminAdminAccountsQueryKey(enabled) });
  };

  const handleAction = async (
    key: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setError("");
    setMessage("");
    setActionLoading(key);
    try {
      await action();
      setMessage(successMessage);
      await invalidate();
    } catch (err) {
      setError(getErrorMessage(err, "Action failed."));
      if (err instanceof ApiError && err.status === 409) {
        await invalidate();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const submitAccessHold = async () => {
    if (!holdTarget) return;
    const target = holdTarget;
    const userRef = pickUserRef(target);
    setHoldTarget(null);
    await handleAction(
      `hold-${userRef}`,
      () => holdAdminAccountAccess(userRef, holdNotes || undefined),
      "Admin console access suspended.",
    );
    setHoldNotes("");
  };

  const submitRemoveAccount = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    const userRef = pickUserRef(target);
    setRemoveTarget(null);
    await handleAction(
      `remove-${userRef}`,
      () => removeAdminAccount(userRef),
      "Admin account removed successfully.",
    );
  };

  return (
    <div className="space-y-4">
      {error ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : null}
      {message ? (
        <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>
          {message}
        </AdminFeedbackMessage>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
          placeholder="Search admin accounts"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setPage(0);
          }}
        />

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AdminSelect
            value={roleFilter}
            onValueChange={(value) => {
              setRoleFilter(value);
              setPage(0);
            }}
            options={ROLE_FILTER_OPTIONS}
            placeholder="Role"
            className="min-w-select-md"
            triggerClassName="w-auto"
            aria-label="Filter by role"
          />

          <AdminSelect
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(0);
            }}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Status"
            className="min-w-select-sm"
            triggerClassName="w-auto"
            aria-label="Filter by status"
          />

          <Button
            variant="outline"
            size="icon"
            disabled={isFetching}
            onClick={() => void refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      <AdminDataTable
        minWidth="lg"
        footer={
          <AdminTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            disabled={isLoading}
            totalCount={filteredAccounts.length}
            currentPageCount={pagination.items.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(0);
            }}
            onPrevious={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell className="w-[3.25rem]">
              <span className="sr-only">Actions</span>
            </AdminTableHeadCell>
            <AdminTableHeadCell>Admin</AdminTableHeadCell>
            <AdminTableHeadCell>Roles</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>MFA</AdminTableHeadCell>
            <AdminTableHeadCell>Access hold</AdminTableHeadCell>
            <AdminTableHeadCell>Deletion schedule</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {isLoading ? (
            <AdminTableSkeletonRows columns={7} />
          ) : accounts.length === 0 ? (
            <AdminTableStateRow colSpan={7}>
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <ShieldCheck className="size-8 text-muted-foreground/60" />
                <p className="font-medium text-foreground">No admin accounts found</p>
                <p className="max-w-md text-caption text-muted-foreground">
                  Platform admin accounts appear here for access hold, restore, and mistaken deletion cleanup.
                </p>
              </div>
            </AdminTableStateRow>
          ) : filteredAccounts.length === 0 ? (
            <AdminTableStateRow colSpan={7}>No admin accounts match your filters.</AdminTableStateRow>
          ) : (
            pagination.items.map((account) => {
              const userRef = pickUserRef(account);
              const isSelf = currentUser?.id === account.user_id;
              const canHold = account.status === "active" && !isSelf;
              const canRestore = account.status === "suspended";
              const canRemove = isSuperAdmin && account.status === "suspended" && !isSelf;
              const canCancelDeletion = account.status === "deletion_pending";

              return (
                <AdminTableRow key={userRef || account.user_id}>
                  <AdminTableCell className="w-[3.25rem] text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Actions for ${account.email}`}
                            disabled={Boolean(actionLoading?.includes(userRef))}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={!canHold || actionLoading === `hold-${userRef}`}
                          onClick={() => {
                            setHoldNotes("");
                            setHoldTarget(account);
                          }}
                        >
                          Put on access hold
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canRestore || actionLoading === `restore-${userRef}`}
                          onClick={() =>
                            void handleAction(
                              `restore-${userRef}`,
                              () => restoreAdminAccountAccess(userRef),
                              "Admin console access restored.",
                            )
                          }
                        >
                          Restore access
                        </DropdownMenuItem>
                        {isSuperAdmin ? (
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={!canRemove || actionLoading === `remove-${userRef}`}
                            onClick={() => setRemoveTarget(account)}
                          >
                            Remove from system
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          disabled={!canCancelDeletion || actionLoading === `cancel-${userRef}`}
                          onClick={() =>
                            void handleAction(
                              `cancel-${userRef}`,
                              () => cancelAdminAccountDeletion(userRef),
                              "Deletion schedule cancelled for this admin account.",
                            )
                          }
                        >
                          Cancel deletion schedule
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{account.display_name}</p>
                      <p className="text-caption text-muted-foreground">{account.email}</p>
                      <p className="font-mono text-micro text-muted-foreground">
                        {displayZyndId(account.client_id || account.user_ref)}
                      </p>
                      {isSelf ? (
                        <p className="text-micro text-muted-foreground">This is your account</p>
                      ) : null}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {account.roles.length === 0 ? (
                        <span className="text-caption text-muted-foreground">No roles assigned</span>
                      ) : (
                        account.roles.map((roleKey) => (
                          <TeamRoleBadge
                            key={roleKey}
                            roleKey={roleKey}
                            label={formatLabel(roleKey)}
                          />
                        ))
                      )}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <UserStatusBadge status={account.status} />
                  </AdminTableCell>
                  <AdminTableCell>
                    <MfaStatusBadge enabled={account.mfa_enrolled} />
                  </AdminTableCell>
                  <AdminTableCell className="text-muted-foreground">
                    {account.status === "suspended" ? (
                      <div className="space-y-1">
                        <p>{formatLabel(account.suspension_reason_code ?? "suspended")}</p>
                        <p className="text-caption">{formatDateTime(account.suspended_at)}</p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                    {account.deletion_scheduled_at ? (
                      <div className="space-y-1">
                        <p>{formatDateTime(account.deletion_scheduled_at)}</p>
                        {account.deletion_requested_at ? (
                          <p className="text-caption">
                            Requested {formatDateTime(account.deletion_requested_at)}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </AdminTableCell>
                </AdminTableRow>
              );
            })
          )}
        </AdminTableBody>
      </AdminDataTable>

      <AdminDialog
        open={holdTarget != null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setHoldTarget(null);
            setHoldNotes("");
          }
        }}
      >
        <AdminDialogContent size="md">
          <AdminDialogHeader
            title="Put admin on access hold"
            description={
              holdTarget
                ? `Suspend console access for ${holdTarget.email}. Active sessions will be revoked immediately.`
                : "Suspend console access immediately."
            }
            icon={ShieldCheck}
            iconTone="warning"
          />
          <AdminDialogBody className="space-y-2 pt-0">
            <Label htmlFor="admin-hold-notes">Internal notes (optional)</Label>
            <textarea
              id="admin-hold-notes"
              rows={3}
              placeholder="Reason for compliance hold"
              value={holdNotes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setHoldNotes(event.target.value)
              }
              className="flex min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-compact text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </AdminDialogBody>
          <AdminDialogFooter>
            <Button variant="outline" onClick={() => setHoldTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!holdTarget || actionLoading === `hold-${pickUserRef(holdTarget)}`}
              onClick={() => void submitAccessHold()}
            >
              {actionLoading === `hold-${holdTarget ? pickUserRef(holdTarget) : ""}`
                ? "Applying..."
                : "Apply access hold"}
            </Button>
          </AdminDialogFooter>
        </AdminDialogContent>
      </AdminDialog>

      <AdminDialog
        open={removeTarget != null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setRemoveTarget(null);
          }
        }}
      >
        {removeTarget ? (
          <AdminDialogContent size="md">
            <AdminDialogHeader
              title="Remove admin account"
              description={`Permanently remove ${removeTarget.email} from the platform. This clears console access, roles, and credentials. The removal is recorded in admin account records.`}
              icon={Trash2}
              iconTone="destructive"
            />
            <AdminDialogFooter>
              <Button variant="outline" onClick={() => setRemoveTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={actionLoading === `remove-${pickUserRef(removeTarget)}`}
                onClick={() => void submitRemoveAccount()}
              >
                {actionLoading === `remove-${pickUserRef(removeTarget)}`
                  ? "Removing..."
                  : "Remove account"}
              </Button>
            </AdminDialogFooter>
          </AdminDialogContent>
        ) : null}
      </AdminDialog>
    </div>
  );
}
