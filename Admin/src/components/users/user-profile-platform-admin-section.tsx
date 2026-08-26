"use client";

import { Clock3, Shield, UserCog } from "lucide-react";

import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminUserSummary } from "@/lib/admin-api";
import { teamRoleBadgeVariant } from "@/lib/admin-role-display";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type UserProfilePlatformAdminSectionProps = {
  summary: AdminUserSummary;
  assignedRoles: string[];
  roleNameByKey: Map<string, string>;
};

export function UserProfilePlatformAdminSection({
  summary,
  assignedRoles,
  roleNameByKey,
}: UserProfilePlatformAdminSectionProps) {
  return (
    <div className="space-y-6">
      <AdminMetricCardsGrid columns="three">
        <AdminMetricCard
          label="Last admin sign-in"
          value={formatDateTime(summary.last_login_at)}
          hint={summary.last_login_method ? `Via ${summary.last_login_method}` : "No recorded sign-in"}
          icon={Clock3}
        />
        <AdminMetricCard
          label="RBAC roles"
          value={String(assignedRoles.length)}
          hint={
            assignedRoles.length
              ? assignedRoles.map((key) => roleNameByKey.get(key) ?? key).join(", ")
              : "No roles assigned"
          }
          icon={Shield}
        />
        <AdminMetricCard
          label="Account created"
          value={formatDateTime(summary.created_at)}
          hint={`Status: ${summary.status}`}
          icon={UserCog}
        />
      </AdminMetricCardsGrid>

      <div className="rounded-[var(--radius-5xl)] border border-border/70 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Assigned RBAC roles</h2>
          <p className="mt-1 text-compact text-muted-foreground">
            Console permissions for distributor hierarchy, compliance, mutual funds, and other
            admin modules.
          </p>
        </div>

        {assignedRoles.length === 0 ? (
          <p className="mt-4 text-compact text-muted-foreground">No RBAC roles assigned yet.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {assignedRoles.map((roleKey) => (
              <StatusBadge key={roleKey} variant={teamRoleBadgeVariant(roleKey)}>
                {roleNameByKey.get(roleKey) ?? roleKey}
              </StatusBadge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
