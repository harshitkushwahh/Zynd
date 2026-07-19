"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Shield, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { RoleEditorDialog, type RoleEditorValues } from "@/components/users/role-editor-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminCardSkeleton } from "@/components/ui/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupCapabilityKeys } from "@/lib/admin-capabilities";
import {
  createAdminRole,
  deleteAdminRole,
  updateAdminRole,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";


function RoleCard({
  role,
  actionLoading,
  onEdit,
  onDelete,
}: {
  role: AdminRole;
  actionLoading: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const groups = groupCapabilityKeys(role.permissions).filter((group) => group.enabledCount > 0);

  return (
    <article className="group overflow-hidden rounded-[var(--radius-card)] border border-border bg-background transition-colors hover:border-primary/20 hover:bg-muted/10">
      <div className="flex items-start gap-3 p-4">
        <div className="rounded-[var(--radius-control)] bg-primary/10 p-2.5 text-primary ring-1 ring-primary/15">
          <Shield className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-compact font-semibold text-foreground">{role.name}</h3>
                <StatusBadge variant={role.is_system ? "neutral" : "info"} showIcon={false}>
                  {role.is_system ? "Built-in" : "Custom"}
                </StatusBadge>
              </div>
              <p className="mt-1.5 text-caption leading-relaxed text-muted-foreground">
                {role.description}
              </p>
            </div>

            <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${role.name}`} onClick={onEdit}>
                <Pencil className="size-3.5" />
              </Button>
              {!role.is_system ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${role.name}`}
                  disabled={actionLoading === `delete-${role.key}`}
                  onClick={onDelete}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <StatusBadge variant="info" showIcon={false}>
              {role.permissions.length}{" "}
              {role.permissions.length === 1 ? "capability" : "capabilities"}
            </StatusBadge>
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

          <Button
            className="mt-4 h-8 w-full sm:w-auto"
            variant="outline"
            size="sm"
            onClick={onEdit}
          >
            Manage access
          </Button>
        </div>
      </div>
    </article>
  );
}

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

          <div className="flex items-center gap-3 lg:shrink-0">
            {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}
            <Button onClick={openCreate}>
              <Plus className="size-3.5" />
              New role
            </Button>
          </div>
        </div>

        {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <AdminCardSkeleton key={index} lines={2} />
            ))}
          </div>
        ) : sortedRoles.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-border px-6 py-empty-state-lg text-center">
            <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
              <Shield className="size-6" />
            </div>
            <p className="mt-3 text-compact font-semibold text-foreground">No roles yet</p>
            <p className="mt-1 max-w-sm text-caption text-muted-foreground">
              Create your first role to control what admins can do in the console.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="size-3.5" />
              Create role
            </Button>
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-border px-6 py-empty-state-lg text-center">
            <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
              <Search className="size-6" />
            </div>
            <p className="mt-3 text-compact font-semibold text-foreground">No matching roles</p>
            <p className="mt-1 max-w-sm text-caption text-muted-foreground">
              Try a different search term or clear the search to see all roles.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredRoles.map((role) => (
              <RoleCard
                key={role.key}
                role={role}
                actionLoading={actionLoading}
                onEdit={() => openEdit(role)}
                onDelete={() => void handleDelete(role)}
              />
            ))}
          </div>
        )}
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
