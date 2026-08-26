"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { RoleEditorDialog, type RoleEditorValues } from "@/components/users/role-editor-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
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
import { groupCapabilityKeys } from "@/lib/admin-capabilities";
import {
  createAdminRole,
  deleteAdminRole,
  updateAdminRole,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-api";

type RolesPermissionsPanelProps = {
  roles: AdminRole[];
  permissionCatalog: AdminPermission[];
  loading: boolean;
  error: string;
  onRolesChanged: () => void;
  onPermissionCreated: (permission: AdminPermission) => void;
};

export function RolesPermissionsPanel({
  roles,
  permissionCatalog,
  loading,
  error,
  onRolesChanged,
  onPermissionCreated,
}: RolesPermissionsPanelProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editorError, setEditorError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
    [roles],
  );

  const filteredRoles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedRoles;

    return sortedRoles.filter((role) => {
      const groups = groupCapabilityKeys(role.permissions).filter((group) => group.enabledCount > 0);
      const haystack = [
        role.name,
        role.key,
        role.description,
        role.is_system ? "built-in" : "custom",
        ...groups.map((group) => group.label),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchQuery, sortedRoles]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, pageSize]);

  const pagination = useMemo(
    () => paginateItems(filteredRoles, page, pageSize),
    [filteredRoles, page, pageSize],
  );

  const openCreate = () => {
    setEditorMode("create");
    setEditingRole(null);
    setEditorError("");
    setEditorOpen(true);
  };

  const openEdit = (role: AdminRole) => {
    setEditorMode("edit");
    setEditingRole(role);
    setEditorError("");
    setEditorOpen(true);
  };

  const handleSave = async (values: RoleEditorValues) => {
    setActionLoading("save-role");
    setEditorError("");
    try {
      if (editorMode === "create") {
        await createAdminRole({
          key: values.key,
          name: values.name,
          description: values.description,
          permissions: values.permissions,
        });
        setMessage(`Created role ${values.name}.`);
      } else if (editingRole) {
        await updateAdminRole(editingRole.key, {
          name: values.name,
          description: values.description,
          permissions: values.permissions,
        });
        setMessage(`Updated role ${values.name}.`);
      }
      setEditorOpen(false);
      onRolesChanged();
    } catch (err) {
      setEditorError(getErrorMessage(err, "Could not save role."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (role: AdminRole) => {
    if (role.is_system) return;
    const confirmed = window.confirm(`Delete role "${role.name}"? This cannot be undone.`);
    if (!confirmed) return;
    setActionLoading(`delete-${role.key}`);
    setMessage("");
    try {
      await deleteAdminRole(role.key);
      setMessage(`Deleted role ${role.name}.`);
      onRolesChanged();
    } catch (err) {
      setEditorError(getErrorMessage(err, "Could not delete role."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <AdminSearchInput
            containerClassName="max-w-sm"
            placeholder="Search roles"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}
            <Button onClick={openCreate}>
              <Plus className="size-3.5" />
              New role
            </Button>
          </div>
        </div>

        {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

        <AdminDataTable
          minWidth="xl"
          footer={
            <AdminTablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              hasPrevious={pagination.hasPrevious}
              hasNext={pagination.hasNext}
              disabled={loading}
              totalCount={filteredRoles.length}
              currentPageCount={pagination.items.length}
              pageSize={pageSize}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(0);
              }}
              onPrevious={() => setPage((value) => Math.max(0, value - 1))}
              onNext={() => setPage((value) => value + 1)}
            />
          }
        >
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
              <AdminTableHeadCell>Role</AdminTableHeadCell>
              <AdminTableHeadCell>Type</AdminTableHeadCell>
              <AdminTableHeadCell>Capabilities</AdminTableHeadCell>
              <AdminTableHeadCell>Access areas</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeletonRows columns={5} />
            ) : sortedRoles.length === 0 ? (
              <AdminTableStateRow colSpan={5}>
                No roles yet. Create a role to control admin access.
              </AdminTableStateRow>
            ) : filteredRoles.length === 0 ? (
              <AdminTableStateRow colSpan={5}>No roles match your search.</AdminTableStateRow>
            ) : (
              pagination.items.map((role) => {
                const groups = groupCapabilityKeys(role.permissions).filter(
                  (group) => group.enabledCount > 0,
                );

                return (
                  <AdminTableRow key={role.key}>
                    <AdminTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(role)}
                        >
                          <Pencil className="size-3.5" />
                          Manage
                        </Button>
                        {!role.is_system ? (
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Delete ${role.name}`}
                            disabled={actionLoading === `delete-${role.key}`}
                            onClick={() => void handleDelete(role)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <p className="font-medium text-foreground">{role.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">
                        {role.description}
                      </p>
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant={role.is_system ? "neutral" : "info"} showIcon={false}>
                        {role.is_system ? "Built-in" : "Custom"}
                      </StatusBadge>
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant="info" showIcon={false}>
                        {role.permissions.length}
                      </StatusBadge>
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {groups.slice(0, 3).map((group) => (
                          <StatusBadge key={group.id} variant="neutral" showIcon={false}>
                            {group.label}
                          </StatusBadge>
                        ))}
                        {groups.length > 3 ? (
                          <StatusBadge variant="neutral" showIcon={false}>
                            +{groups.length - 3} more
                          </StatusBadge>
                        ) : null}
                      </div>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminDataTable>
      </div>

      <RoleEditorDialog
        open={editorOpen}
        mode={editorMode}
        role={editingRole}
        permissionCatalog={permissionCatalog}
        saving={actionLoading === "save-role"}
        error={editorError}
        onClose={() => setEditorOpen(false)}
        onSave={(values) => void handleSave(values)}
        onPermissionCreated={onPermissionCreated}
      />
    </>
  );
}
