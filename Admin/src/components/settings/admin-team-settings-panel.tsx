"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { UserRoleAssignmentPanel } from "@/components/users/user-role-assignment-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSettingsPanelSkeleton } from "@/components/ui/admin-skeletons";
import { fetchAdminRoles, type AdminRole } from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";


export function AdminTeamSettingsPanel({
  trailingToolbar,
}: {
  trailingToolbar?: React.ReactNode;
}) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRoles(await fetchAdminRoles());
    } catch (err) {
      setRoles([]);
      setError(getErrorMessage(err, "Could not load roles."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  if (loading) {
    return <AdminSettingsPanelSkeleton withTable tableColumns={5} />;
  }

  return (
    <div className="space-y-3">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      <UserRoleAssignmentPanel roles={roles} trailingToolbar={trailingToolbar} />
    </div>
  );
}
