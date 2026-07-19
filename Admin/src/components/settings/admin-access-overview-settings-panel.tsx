"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { AccessOverviewPanel } from "@/components/users/access-overview-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSettingsPanelSkeleton } from "@/components/ui/admin-skeletons";
import { fetchAdminRoles, fetchAdminPermissions, type AdminPermission, type AdminRole } from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";


export function AdminAccessOverviewSettingsPanel() {
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
      setError(getErrorMessage(err, "Could not load access overview."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return <AdminSettingsPanelSkeleton withTable tableColumns={6} />;
  }

  return (
    <div className="space-y-3">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      <AccessOverviewPanel roles={roles} permissionCatalog={permissionCatalog} />
    </div>
  );
}
