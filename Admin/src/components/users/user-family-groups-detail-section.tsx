"use client";

import { useCallback, useEffect, useState } from "react";
import { UsersRound } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminTableSkeleton } from "@/components/ui/admin-skeletons";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchAdminUserFamilyGroups, type AdminUserFamilyGroups } from "@/lib/family-groups-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";
import { PROFILE_SECTION_TITLE_CLASS } from "@/components/users/user-profile-typography";

type UserFamilyGroupsDetailSectionProps = {
  userId: string;
};

function statusVariant(status: string): "success" | "neutral" | "info" {
  if (status === "active") return "success";
  if (status === "archived") return "neutral";
  return "info";
}

export function UserFamilyGroupsDetailSection({ userId }: UserFamilyGroupsDetailSectionProps) {
  const [payload, setPayload] = useState<AdminUserFamilyGroups | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminUserFamilyGroups(userId);
      setPayload(result);
    } catch (err) {
      setPayload(null);
      setError(getErrorMessage(err, "Could not load family groups for this user."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  if (loading) {
    return <AdminTableSkeleton columns={1} rows={3} minWidth="sm" />;
  }

  if (error) {
    return <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>;
  }

  if (!payload || (payload.memberships.length === 0 && payload.created_groups.length === 0)) {
    return (
      <p className="text-caption text-muted-foreground">
        This user is not part of any family groups yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {payload.created_groups.length > 0 ? (
        <div className="space-y-3">
          <p className={PROFILE_SECTION_TITLE_CLASS}>Groups created</p>
          <div className="space-y-2">
            {payload.created_groups.map((group) => (
              <div
                key={group.id}
                className="rounded-[var(--radius-control)] border border-border/70 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-compact font-medium text-foreground">{group.title}</p>
                  <StatusBadge variant={statusVariant(group.status)} showIcon={false}>
                    {group.status}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {group.member_count} members · created {formatTimestampDetail(group.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {payload.memberships.length > 0 ? (
        <div className="space-y-3">
          <p className={PROFILE_SECTION_TITLE_CLASS}>Memberships</p>
          <div className="space-y-2">
            {payload.memberships.map((membership) => (
              <div
                key={membership.group_id}
                className="rounded-[var(--radius-control)] border border-border/70 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-compact font-medium text-foreground">{membership.title}</p>
                  <StatusBadge variant={statusVariant(membership.status)} showIcon={false}>
                    {membership.role}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {membership.member_count} members
                  {membership.badge_label ? ` · ${membership.badge_label}` : ""} · joined{" "}
                  {formatTimestampDetail(membership.joined_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
