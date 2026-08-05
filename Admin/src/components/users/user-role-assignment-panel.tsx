"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  Plus,
  RefreshCw,
  Settings2,
  UserCog,
} from "lucide-react";

import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

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

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminDialogFooterActions,
  AdminFormDialog,
} from "@/components/ui/admin-dialog-presets";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { SendAdminInvitationDialog } from "@/components/users/send-admin-invitation-dialog";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { userInitials } from "@/lib/admin-capabilities";
import {
  assignAdminUserRole,
  createAdminInvitation,
  fetchAdminUserRoles,
  fetchAdminUsers,
  setAdminUserRoles,
  type AdminRole,
  type AdminUserListItem,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";


function ManageRolesDialog({
  open,
  user,
  roles,
  currentRoleKeys,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  user: AdminUserListItem | null;
  roles: AdminRole[];
  currentRoleKeys: string[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (roleKeys: string[]) => void;
}) {
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelectedRoleKeys(currentRoleKeys);
  }, [open, currentRoleKeys]);

  if (!open || !user) return null;

  const toggleRole = (roleKey: string) => {
    setSelectedRoleKeys((current) =>
      current.includes(roleKey) ? current.filter((key) => key !== roleKey) : [...current, roleKey],
    );
  };

  return (
    <AdminFormDialog
      open={open}
      onClose={onClose}
      title="Manage team roles"
      description={`${user.display_name} · ${user.email}`}
      icon={UserCog}
      iconTone="info"
      size="md"
      footer={
        <AdminDialogFooterActions
          cancelLabel="Cancel"
          confirmLabel="Save roles"
          loading={saving}
          loadingLabel="Saving..."
          confirmDisabled={selectedRoleKeys.length === 0}
          onCancel={onClose}
          onConfirm={() => onSave(selectedRoleKeys)}
        />
      }
    >
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <div className="space-y-3">
        {roles.map((role) => {
          const checked = selectedRoleKeys.includes(role.key);
          return (
            <label
              key={role.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-card border px-4 py-3 transition-colors",
                checked ? "border-primary/30 bg-primary/5" : "border-border bg-background",
              )}
            >
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-input"
                checked={checked}
                onChange={() => toggleRole(role.key)}
              />
              <span className="min-w-0">
                <span className="block text-compact font-medium text-foreground">{role.name}</span>
                <span className="mt-0.5 block text-caption text-muted-foreground">{role.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </AdminFormDialog>
  );
}

type UserRoleAssignmentPanelProps = {
  roles: AdminRole[];
};

export function UserRoleAssignmentPanel({ roles }: UserRoleAssignmentPanelProps) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [teamRolesByUserId, setTeamRolesByUserId] = useState<Record<string, string[]>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [roleToAssign, setRoleToAssign] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDialogError, setInviteDialogError] = useState("");
  const [manageUser, setManageUser] = useState<AdminUserListItem | null>(null);
  const [manageDialogError, setManageDialogError] = useState("");

  const roleNameByKey = useMemo(
    () => new Map(roles.map((role) => [role.key, role.name])),
    [roles],
  );

  const loadTeamRoles = useCallback(async (adminUsers: AdminUserListItem[]) => {
    if (adminUsers.length === 0) {
      setTeamRolesByUserId({});
      return;
    }

    setRolesLoading(true);
    try {
      const entries = await Promise.all(
        adminUsers.map(async (user) => {
          try {
            const result = await fetchAdminUserRoles(user.client_id);
            return [user.user_id, result.roles] as const;
          } catch {
            return [user.user_id, []] as const;
          }
        }),
      );
      setTeamRolesByUserId(Object.fromEntries(entries));
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await fetchAdminUsers({
        email: emailFilter.trim() || undefined,
        role: "admin",
        limit: ADMIN_TABLE_PAGE_SIZE,
        offset,
      });
      setUsers(items);
      setHasMore(items.length === ADMIN_TABLE_PAGE_SIZE);
      await loadTeamRoles(items);
    } catch (err) {
      setUsers([]);
      setTeamRolesByUserId({});
      setError(getErrorMessage(err, "Could not load admin accounts."));
    } finally {
      setLoading(false);
    }
  }, [emailFilter, loadTeamRoles, offset]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setSelectedUserIds(new Set());
  }, [offset, emailFilter]);

  const allSelected =
    users.length > 0 && users.every((user) => selectedUserIds.has(user.user_id));

  const toggleUser = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedUserIds(new Set());
      return;
    }
    setSelectedUserIds(new Set(users.map((user) => user.user_id)));
  };

  const handleSearch = () => {
    if (offset === 0) {
      void loadUsers();
      return;
    }
    setOffset(0);
  };

  const handleSendInvitation = async (payload: {
    email: string;
    first_name?: string;
    last_name?: string;
    role_key: string;
  }) => {
    setActionLoading(true);
    setInviteDialogError("");
    try {
      const invitation = await createAdminInvitation(payload);
      setInviteDialogOpen(false);
      setMessage(`Invitation sent to ${invitation.email}.`);
    } catch (err) {
      setInviteDialogError(getErrorMessage(err, "Could not send invitation."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!roleToAssign || selectedUserIds.size === 0) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    const selectedUsers = users.filter((user) => selectedUserIds.has(user.user_id));
    let assigned = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const user of selectedUsers) {
      const existing = teamRolesByUserId[user.user_id] ?? [];
      if (existing.includes(roleToAssign)) {
        skipped += 1;
        continue;
      }

      try {
        const result = await assignAdminUserRole(user.client_id, roleToAssign);
        setTeamRolesByUserId((current) => ({
          ...current,
          [user.user_id]: result.roles,
        }));
        assigned += 1;
      } catch (err) {
        failures.push(`${user.display_name}: ${getErrorMessage(err, "Assignment failed")}`);
      }
    }

    const roleName = roleNameByKey.get(roleToAssign) ?? roleToAssign;
    if (assigned > 0) {
      setMessage(
        `Assigned ${roleName} to ${assigned} admin${assigned === 1 ? "" : "s"}${
          skipped > 0 ? ` · ${skipped} skipped` : ""
        }.`,
      );
      setSelectedUserIds(new Set());
    } else if (failures.length > 0) {
      setError(failures[0] ?? "Could not assign role.");
    } else {
      setMessage(`No changes made. Selected admins may already have ${roleName}.`);
    }

    if (failures.length > 1) {
      setError(`${failures.length} assignments failed. ${failures[0]}`);
    }

    setActionLoading(false);
  };

  const handleSaveRoles = async (roleKeys: string[]) => {
    if (!manageUser) return;

    setActionLoading(true);
    setManageDialogError("");
    try {
      const result = await setAdminUserRoles(manageUser.client_id, roleKeys);
      setTeamRolesByUserId((current) => ({
        ...current,
        [manageUser.user_id]: result.roles,
      }));
      setManageUser(null);
      setMessage(`Updated team roles for ${manageUser.display_name}.`);
    } catch (err) {
      setManageDialogError(getErrorMessage(err, "Could not update team roles."));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <AdminSearchInput
            containerClassName="max-w-sm"
            placeholder="Search admin accounts"
            value={emailFilter}
            onChange={(event) => setEmailFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSearch();
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => void loadUsers()} aria-label="Refresh">
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <Plus className="size-3.5" />
              Send invitation
            </Button>
          </div>
        </div>

        {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
        {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

        {selectedUserIds.size > 0 ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-compact font-medium text-foreground">
              {selectedUserIds.size} admin{selectedUserIds.size === 1 ? "" : "s"} selected
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={roleToAssign} onValueChange={(value) => setRoleToAssign(value ?? "")}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Choose team role">
                    {roleToAssign
                      ? (roleNameByKey.get(roleToAssign) ?? roleToAssign)
                      : "Choose team role"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button disabled={!roleToAssign || actionLoading} onClick={() => void handleBulkAssign()}>
                <UserCog className="size-4" />
                {actionLoading ? "Assigning..." : "Assign role"}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedUserIds(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        <AdminDataTable minWidth="4xl">
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
              <AdminTableHeadCell className="w-10">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={allSelected}
                  disabled={users.length === 0 || loading}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  aria-label="Select all admin accounts on this page"
                />
              </AdminTableHeadCell>
              <AdminTableHeadCell>Admin</AdminTableHeadCell>
              <AdminTableHeadCell>Email</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
              <AdminTableHeadCell>Team roles</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeletonRows columns={6} />
            ) : users.length === 0 ? (
              <AdminTableStateRow colSpan={6}>
                No admin accounts found. Add one to get started.
              </AdminTableStateRow>
            ) : (
              users.map((user) => {
                const teamRoles = teamRolesByUserId[user.user_id] ?? [];
                const selected = selectedUserIds.has(user.user_id);

                return (
                  <AdminTableRow
                    key={user.user_id}
                    className={cn("hover:bg-muted/20", selected && "bg-primary/5")}
                  >
                    <AdminTableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setManageDialogError("");
                            setManageUser(user);
                          }}
                        >
                          <Settings2 className="size-3.5" />
                          Manage roles
                        </Button>
                    </AdminTableCell>
                    <AdminTableCell>
                        <input
                          type="checkbox"
                          className="size-4 rounded border-input"
                          checked={selected}
                          onChange={(event) => toggleUser(user.user_id, event.target.checked)}
                          aria-label={`Select ${user.display_name}`}
                        />
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          <AvatarFallback className="bg-primary/10 text-caption font-medium text-primary">
                            {userInitials(user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">{user.display_name}</span>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell className="text-muted-foreground">{user.email}</AdminTableCell>
                    <AdminTableCell>
                      <UserStatusBadge status={user.status} />
                    </AdminTableCell>
                    <AdminTableCell>
                        {rolesLoading && teamRoles.length === 0 ? (
                          <Skeleton className="h-5 w-24" />
                        ) : teamRoles.length === 0 ? (
                          <span className="text-caption text-muted-foreground">No roles assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {teamRoles.map((roleKey) => (
                              <StatusBadge key={roleKey} variant="info" showIcon={false}>
                                {roleNameByKey.get(roleKey) ?? roleKey}
                              </StatusBadge>
                            ))}
                          </div>
                        )}
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminDataTable>

        <AdminTablePagination
          page={getOffsetPage(offset)}
          hasPrevious={offset > 0}
          hasNext={hasMore}
          disabled={loading}
          onPrevious={() => setOffset((value) => Math.max(0, value - ADMIN_TABLE_PAGE_SIZE))}
          onNext={() => setOffset((value) => value + ADMIN_TABLE_PAGE_SIZE)}
        />
      </div>

      <SendAdminInvitationDialog
        open={inviteDialogOpen}
        roles={roles}
        saving={actionLoading}
        error={inviteDialogError}
        onClose={() => {
          setInviteDialogOpen(false);
          setInviteDialogError("");
        }}
        onSend={(payload) => void handleSendInvitation(payload)}
      />

      <ManageRolesDialog
        open={manageUser != null}
        user={manageUser}
        roles={roles}
        currentRoleKeys={manageUser ? (teamRolesByUserId[manageUser.user_id] ?? []) : []}
        saving={actionLoading}
        error={manageDialogError}
        onClose={() => {
          setManageUser(null);
          setManageDialogError("");
        }}
        onSave={(roleKeys) => void handleSaveRoles(roleKeys)}
      />
    </>
  );
}
