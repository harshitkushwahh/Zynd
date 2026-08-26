"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Shield } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { Button } from "@/components/ui/button";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminDialogFooterActions,
  AdminFormDialog,
} from "@/components/ui/admin-dialog-presets";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CAPABILITY_GROUPS,
  capabilityDescription,
  capabilityLabel,
  orphanCapabilities,
} from "@/lib/admin-capabilities";
import {
  createAdminPermission,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-api";


function slugifyRoleKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export type RoleEditorValues = {
  key: string;
  name: string;
  description: string;
  permissions: string[];
};

type RoleEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  role?: AdminRole | null;
  permissionCatalog: AdminPermission[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: RoleEditorValues) => void;
  onPermissionCreated: (permission: AdminPermission) => void;
};

export function RoleEditorDialog({
  open,
  mode,
  role,
  permissionCatalog,
  saving,
  error,
  onClose,
  onSave,
  onPermissionCreated,
}: RoleEditorDialogProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [customPermissionKey, setCustomPermissionKey] = useState("");
  const [customPermissionDescription, setCustomPermissionDescription] = useState("");
  const [localError, setLocalError] = useState("");
  const [creatingPermission, setCreatingPermission] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && role) {
      setName(role.name);
      setKey(role.key);
      setDescription(role.description);
      setSelectedPermissions(role.permissions);
    } else {
      setName("");
      setKey("");
      setDescription("");
      setSelectedPermissions([]);
    }
    setCustomPermissionKey("");
    setCustomPermissionDescription("");
    setLocalError("");
  }, [mode, open, role]);

  useEffect(() => {
    if (mode === "create" && !key.trim() && name.trim()) {
      setKey(slugifyRoleKey(name));
    }
  }, [key, mode, name]);

  const customCapabilities = useMemo(
    () => orphanCapabilities(selectedPermissions, permissionCatalog),
    [permissionCatalog, selectedPermissions],
  );

  const catalogKeys = useMemo(
    () => new Set(permissionCatalog.map((item) => item.key)),
    [permissionCatalog],
  );

  const togglePermission = (permissionKey: string) => {
    setSelectedPermissions((current) =>
      current.includes(permissionKey)
        ? current.filter((item) => item !== permissionKey)
        : [...current, permissionKey],
    );
  };

  const handleCreatePermission = async () => {
    if (!customPermissionKey.trim() || !customPermissionDescription.trim()) return;
    setCreatingPermission(true);
    setLocalError("");
    try {
      const created = await createAdminPermission({
        key: customPermissionKey.trim().toLowerCase(),
        description: customPermissionDescription.trim(),
      });
      onPermissionCreated(created);
      setSelectedPermissions((current) =>
        current.includes(created.key) ? current : [...current, created.key],
      );
      setCustomPermissionKey("");
      setCustomPermissionDescription("");
    } catch (err) {
      setLocalError(getErrorMessage(err, "Could not create permission."));
    } finally {
      setCreatingPermission(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !description.trim()) {
      setLocalError("Name and description are required.");
      return;
    }
    if (mode === "create" && !key.trim()) {
      setLocalError("Role key is required.");
      return;
    }
    onSave({
      key: key.trim(),
      name: name.trim(),
      description: description.trim(),
      permissions: selectedPermissions,
    });
  };

  if (!open) return null;

  return (
    <AdminFormDialog
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create role" : `Edit ${role?.name ?? "role"}`}
      description="Choose what this team role can do in the admin console."
      icon={Shield}
      iconTone="info"
      size="detail"
      bodyClassName="max-h-dialog-body-form"
      footer={
        <AdminDialogFooterActions
          cancelLabel="Cancel"
          confirmLabel={mode === "create" ? "Create role" : "Save changes"}
          loading={saving}
          loadingLabel="Saving..."
          onCancel={onClose}
          onConfirm={handleSubmit}
        />
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input
                id="role-name"
                placeholder="e.g. Support lead"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            {mode === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="role-key">Role key</Label>
                <Input
                  id="role-key"
                  placeholder="support_lead"
                  value={key}
                  onChange={(event) => setKey(slugifyRoleKey(event.target.value))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Role key</Label>
                <p className="rounded-[var(--radius-control)] border border-border bg-muted/40 px-3 py-2 text-compact text-muted-foreground">
                  {role?.key}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              placeholder="What is this role for?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div>
              <p className="font-medium text-foreground">Capabilities</p>
              <p className="text-caption text-muted-foreground">
                Turn on the actions this role should be allowed to perform.
              </p>
            </div>

            {CAPABILITY_GROUPS.map((group) => (
              <div
                key={group.id}
                className="rounded-[var(--radius-card)] border border-border p-4"
              >
                <div className="mb-3">
                  <p className="font-medium text-foreground">{group.label}</p>
                  <p className="text-caption text-muted-foreground">{group.description}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.capabilities.map((capability) => {
                    const disabled = !catalogKeys.has(capability.key);
                    const checked = selectedPermissions.includes(capability.key);
                    return (
                      <label
                        key={capability.key}
                        className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border px-3 py-3 transition-colors ${
                          checked
                            ? "border-primary/40 bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => togglePermission(capability.key)}
                        />
                        <span>
                          <span className="block text-compact font-medium text-foreground">
                            {capability.label}
                          </span>
                          <span className="block text-caption text-muted-foreground">
                            {capability.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {customCapabilities.length > 0 ? (
              <div className="rounded-[var(--radius-card)] border border-border p-4">
                <p className="mb-3 font-medium text-foreground">Custom permissions</p>
                <div className="space-y-2">
                  {customCapabilities.map((capability) => (
                    <label
                      key={capability.key}
                      className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border px-3 py-3"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedPermissions.includes(capability.key)}
                        onChange={() => togglePermission(capability.key)}
                      />
                      <span>
                        <span className="block text-compact font-medium text-foreground">
                          {capabilityLabel(capability.key)}
                        </span>
                        <span className="block text-caption text-muted-foreground">
                          {capabilityDescription(capability.key)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[var(--radius-card)] border border-dashed border-border p-4">
              <p className="mb-3 font-medium text-foreground">Add a custom permission</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="area.action"
                  value={customPermissionKey}
                  onChange={(event) => setCustomPermissionKey(event.target.value)}
                />
                <Input
                  placeholder="What does this allow?"
                  value={customPermissionDescription}
                  onChange={(event) => setCustomPermissionDescription(event.target.value)}
                />
              </div>
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                disabled={creatingPermission}
                onClick={() => void handleCreatePermission()}
              >
                <Plus className="size-3.5" />
                {creatingPermission ? "Adding..." : "Add permission"}
              </Button>
            </div>
          </div>

          {localError ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setLocalError("")}>{localError}</AdminFeedbackMessage> : null}
          {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
        </div>
    </AdminFormDialog>
  );
}
