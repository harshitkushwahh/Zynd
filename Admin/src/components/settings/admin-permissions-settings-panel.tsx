"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { PermissionsCatalogPanel } from "@/components/users/permissions-catalog-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSettingsPanelSkeleton } from "@/components/ui/admin-skeletons";
import { fetchAdminPermissions, type AdminPermission } from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";


export function AdminPermissionsSettingsPanel() {
  const [permissionCatalog, setPermissionCatalog] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPermissionCatalog(await fetchAdminPermissions());
    } catch (err) {
      setPermissionCatalog([]);
      setError(getErrorMessage(err, "Could not load permissions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return <AdminSettingsPanelSkeleton withTable tableColumns={4} />;
  }

  return (
    <div className="space-y-3">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      <PermissionsCatalogPanel
        permissionCatalog={permissionCatalog}
        loading={loading}
        error={error}
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
