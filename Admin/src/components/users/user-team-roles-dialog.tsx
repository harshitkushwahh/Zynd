"use client";

import { Plus, Shield, X } from "lucide-react";

import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogHeader,
} from "@/components/ui/admin-dialog";
import { Button } from "@/components/ui/button";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminRole, AdminUserSummary } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { PROFILE_SECTION_TITLE_CLASS } from "@/components/users/user-profile-typography";

type UserTeamRolesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: AdminUserSummary;
  roles: AdminRole[];
  assignedRoles: string[];
  roleNameByKey: Map<string, string>;
  availableRoles: AdminRole[];
  roleToAssign: string;
  actionLoading: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onRoleToAssignChange: (value: string) => void;
  onAssignRole: () => void;
  onRevokeRole: (roleKey: string) => void;
};

export function UserTeamRolesDialog({
  open,
  onOpenChange,
  summary,
  roles,
  assignedRoles,
  roleNameByKey,
  availableRoles,
  roleToAssign,
  actionLoading,
  searchQuery,
  onSearchQueryChange,
  onRoleToAssignChange,
  onAssignRole,
  onRevokeRole,
}: UserTeamRolesDialogProps) {
  const isAdmin = summary.role === "admin";
  const assignedSet = new Set(assignedRoles);

  const filteredRoles = roles.filter((role) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [role.name, role.key, role.description]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent size="lg" className="max-h-[min(90vh,52rem)]">
        <AdminDialogHeader
          title="Team roles"
          description="Console access roles available for admin accounts."
          icon={Shield}
          iconTone="info"
        />
        <AdminDialogBody className="space-y-4 pt-0">
          {!isAdmin ? (
            <p className="rounded-[var(--radius-control)] border border-border bg-muted/20 px-4 py-3 text-caption text-muted-foreground">
              This customer account does not use RBAC roles. The roles below apply to admin console
              accounts only.
            </p>
          ) : (
            <div className="rounded-[var(--radius-control)] border border-border bg-muted/20 px-4 py-3">
              <p className={PROFILE_SECTION_TITLE_CLASS}>Assigned to this admin</p>
              {assignedRoles.length === 0 ? (
                <p className="mt-1 text-caption text-muted-foreground">No team roles assigned yet.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {assignedRoles.map((roleKey) => (
                    <li key={roleKey}>
                      <StatusBadge variant="info" showIcon={false} className="gap-1 pr-1">
                        {roleNameByKey.get(roleKey) ?? roleKey}
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-current/80 hover:bg-background/20 hover:text-current"
                          disabled={actionLoading === `revoke-${roleKey}`}
                          onClick={() => onRevokeRole(roleKey)}
                          aria-label={`Remove ${roleNameByKey.get(roleKey) ?? roleKey}`}
                        >
                          <X className="size-3" />
                        </button>
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <AdminSearchInput
            containerClassName="max-w-sm"
            placeholder="Search team roles"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />

          <AdminDataTable minWidth="lg">
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHeadCell>Role</AdminTableHeadCell>
                <AdminTableHeadCell>Type</AdminTableHeadCell>
                <AdminTableHeadCell>Permissions</AdminTableHeadCell>
                {isAdmin ? <AdminTableHeadCell>Assigned</AdminTableHeadCell> : null}
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              {filteredRoles.length === 0 ? (
                <AdminTableStateRow colSpan={isAdmin ? 4 : 3}>
                  No team roles match your search.
                </AdminTableStateRow>
              ) : (
                filteredRoles.map((role) => (
                  <AdminTableRow key={role.key}>
                    <AdminTableCell>
                      <p className="font-medium text-foreground">{role.name}</p>
                      {role.description ? (
                        <p className="mt-0.5 text-caption text-muted-foreground">{role.description}</p>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant={role.is_system ? "neutral" : "info"} showIcon={false}>
                        {role.is_system ? "Built-in" : "Custom"}
                      </StatusBadge>
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums text-muted-foreground">
                      {role.permissions.length}
                    </AdminTableCell>
                    {isAdmin ? (
                      <AdminTableCell>
                        {assignedSet.has(role.key) ? (
                          <StatusBadge variant="success" showIcon={false}>
                            Assigned
                          </StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </AdminTableCell>
                    ) : null}
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminDataTable>

          {isAdmin && availableRoles.length > 0 ? (
            <div className="rounded-[var(--radius-control)] border border-dashed border-border bg-muted/10 px-4 py-3">
              <p className="mb-2 text-caption font-medium text-muted-foreground">Assign role</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={roleToAssign} onValueChange={(value) => onRoleToAssignChange(value ?? "")}>
                  <SelectTrigger className="w-full sm:flex-1">
                    <SelectValue placeholder="Choose a team role">
                      {roleToAssign
                        ? (roleNameByKey.get(roleToAssign) ?? roleToAssign)
                        : "Choose a team role"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.key} value={role.key}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className={cn("shrink-0")}
                  disabled={!roleToAssign || actionLoading?.startsWith("assign-")}
                  onClick={onAssignRole}
                >
                  <Plus className="size-4" />
                  Add role
                </Button>
              </div>
            </div>
          ) : null}
        </AdminDialogBody>
      </AdminDialogContent>
    </AdminDialog>
  );
}
