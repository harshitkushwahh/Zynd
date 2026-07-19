"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { useAdminAuth } from "@/contexts/admin-auth-context";

export function AdminMfaPinStatusBadges() {
  const { user } = useAdminAuth();

  if (!user) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <StatusBadge variant={user.mfa_enrolled ? "success" : "warning"}>
        {user.mfa_enrolled ? "MFA enabled" : "MFA not enabled"}
      </StatusBadge>
      <StatusBadge variant={user.pin_enrolled ? "success" : "neutral"}>
        {user.pin_enrolled ? "PIN enabled" : "PIN not set up"}
      </StatusBadge>
    </div>
  );
}
