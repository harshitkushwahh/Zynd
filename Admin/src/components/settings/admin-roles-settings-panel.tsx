"use client";

import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";

import { RolesPermissionsPanel } from "@/components/users/roles-permissions-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminCardListSkeleton } from "@/components/ui/admin-skeletons";
import {
  ADMIN_PERMISSIONS_QUERY_KEY,
  useAdminRbacQuery,
} from "@/hooks/use-admin-rbac-query";
import { type AdminPermission } from "@/lib/admin-api";


export function AdminRolesSettingsPanel() {
  const queryClient = useQueryClient();
  const { roles, permissionCatalog, isLoading, error, refetch } = useAdminRbacQuery();
  const errorMessage = error ? getErrorMessage(error, "Could not load roles.") : "";

  const loadData = async () => {
    await refetch();
  };

  if (isLoading && roles.length === 0 && permissionCatalog.length === 0) {
    return <AdminCardListSkeleton count={4} lines={2} />;
  }

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setErrorMessage("")}>{errorMessage}</AdminFeedbackMessage>
      ) : null}
      <RolesPermissionsPanel
        roles={roles}
        permissionCatalog={permissionCatalog}
        loading={false}
        error={errorMessage}
        onRolesChanged={() => void loadData()}
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
