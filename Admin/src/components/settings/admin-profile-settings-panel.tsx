"use client";

import { Mail } from "lucide-react";

import { MfaStatusBadge } from "@/components/users/user-status-badge";
import { AdminSettingsDetailRow } from "@/components/settings/admin-settings-detail-row";
import { useAdminAuth } from "@/contexts/admin-auth-context";

export function AdminProfileSettingsPanel() {
  const { user, displayName } = useAdminAuth();

  if (!user) return null;

  return (
    <div className="space-y-1">
      <AdminSettingsDetailRow label="Display name" value={displayName} />
      <AdminSettingsDetailRow label="Email" value={user.email} icon={Mail} />
      <AdminSettingsDetailRow label="Account type" value="Admin console" />
      <AdminSettingsDetailRow
        label="MFA and PIN lock"
        value={
          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
            <MfaStatusBadge enabled={user.mfa_enrolled} />
            <span className="text-caption text-muted-foreground">
              {user.pin_enrolled ? "PIN enabled" : "PIN not set up"}
            </span>
          </div>
        }
      />
    </div>
  );
}
