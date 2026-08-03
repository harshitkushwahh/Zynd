"use client";

import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";

import { PermissionsCatalogPanel } from "@/components/users/permissions-catalog-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSettingsPanelSkeleton } from "@/components/ui/admin-skeletons";
import {
  ADMIN_PERMISSIONS_QUERY_KEY,
  useAdminPermissionsQuery,
} from "@/hooks/use-admin-rbac-query";
import { type AdminPermission } from "@/lib/admin-api";


export function AdminPermissionsSettingsPanel() {
  const queryClient = useQueryClient();
  const { data: permissionCatalog = [], isLoading, error } = useAdminPermissionsQuery();
  const errorMessage = error ? getErrorMessage(error, "Could not load permissions.") : "";

  if (isLoading && permissionCatalog.length === 0) {
    return <AdminSettingsPanelSkeleton withTable tableColumns={4} />;
  }

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <AdminFeedbackMessage variant="destructive">{errorMessage}</AdminFeedbackMessage>
      ) : null}
      <PermissionsCatalogPanel
        permissionCatalog={permissionCatalog}
        loading={false}
        error={errorMessage}
        onPermissionCreated={(permission) =>
          queryClient.setQueryData<AdminPermission[]>(ADMIN_PERMISSIONS_QUERY_KEY, (current) => {
            const catalog = current ?? [];
            return catalog.some((item) => item.key === permission.key)
              ? catalog
              : [...catalog, permission].sort((a, b) => a.key.localeCompare(b.key));
          })
        }
      />
    </div>
  );
}
