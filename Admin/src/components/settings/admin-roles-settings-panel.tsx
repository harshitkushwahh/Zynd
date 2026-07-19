"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { RolesPermissionsPanel } from "@/components/users/roles-permissions-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminCardListSkeleton } from "@/components/ui/admin-skeletons";
import {
  fetchAdminPermissions,
  fetchAdminRoles,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";


export function AdminRolesSettingsPanel() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rolesResult, permissionsResult] = await Promise.all([
        fetchAdminRoles(),
        fetchAdminPermissions(),
      ]);
      setRoles(rolesResult);
      setPermissionCatalog(permissionsResult);
    } catch (err) {
      setRoles([]);
      setPermissionCatalog([]);
      setError(getErrorMessage(err, "Could not load roles."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return <AdminCardListSkeleton count={4} lines={2} />;
  }

  return (
    <div className="space-y-3">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      <RolesPermissionsPanel
        roles={roles}
        permissionCatalog={permissionCatalog}
        loading={loading}
        error={error}
        onRolesChanged={() => void loadData()}
        onPermissionCreated={(permission) =>
          setPermissionCatalog((current) =>
            current.some((item) => item.key === permission.key)
              ? current
              : [...current, permission].sort((a, b) => a.key.localeCompare(b.key)),
          )
        }
      />
    </div>
  );
}
