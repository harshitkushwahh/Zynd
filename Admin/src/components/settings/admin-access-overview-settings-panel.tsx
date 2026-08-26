"use client";

import { getErrorMessage } from "@/lib/errors";

import { AccessOverviewPanel } from "@/components/users/access-overview-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSettingsPanelSkeleton } from "@/components/ui/admin-skeletons";
import { useAdminRbacQuery } from "@/hooks/use-admin-rbac-query";


export function AdminAccessOverviewSettingsPanel() {
  const { roles, permissionCatalog, isLoading, error } = useAdminRbacQuery();
  const errorMessage = error ? getErrorMessage(error, "Could not load access overview.") : "";

  if (isLoading && roles.length === 0 && permissionCatalog.length === 0) {
    return <AdminSettingsPanelSkeleton withTable tableColumns={6} />;
  }

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setErrorMessage("")}>{errorMessage}</AdminFeedbackMessage>
      ) : null}
      <AccessOverviewPanel roles={roles} permissionCatalog={permissionCatalog} />
    </div>
  );
}
