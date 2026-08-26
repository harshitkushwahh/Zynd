"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { UsersRound } from "lucide-react";

import { AdminUserProfileSectionEmptyState } from "@/components/users/admin-user-profile-section-empty-state";
import { AdminFamilyGroupSubCard } from "@/components/users/admin-family-group-sub-card";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminTableSkeleton } from "@/components/ui/admin-skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminUserFamilyGroupsQuery } from "@/hooks/use-admin-user-family-groups-query";
import { userFamilyGroupDetailHref } from "@/lib/admin-user-family-group-navigation";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";
import { PROFILE_SECTION_TITLE_CLASS } from "@/components/users/user-profile-typography";

type UserFamilyGroupsDetailSectionProps = {
  userId: string;
  profilePath: string;
};

type FamilyGroupsFilter = "all" | "created" | "memberships";

const FAMILY_GROUPS_FILTER_OPTIONS: Array<{ value: FamilyGroupsFilter; label: string }> = [
  { value: "all", label: "All groups" },
  { value: "created", label: "Groups created" },
  { value: "memberships", label: "Memberships" },
];

function statusVariant(status: string): "success" | "neutral" | "info" {
  if (status === "active") return "success";
  if (status === "archived") return "neutral";
  return "info";
}

function roleVariant(role: string): "success" | "neutral" | "info" {
  if (role === "head") return "success";
  if (role === "member") return "neutral";
  return "info";
}

export function UserFamilyGroupsDetailSection({
  userId,
  profilePath,
}: UserFamilyGroupsDetailSectionProps) {
  const router = useRouter();
  const { data: payload, isPending, error: queryError } = useAdminUserFamilyGroupsQuery(userId);
  const showSkeleton = isPending && !payload;
  const error = queryError
    ? getErrorMessage(queryError, "Could not load family groups for this user.")
    : "";
  const [filter, setFilter] = useState<FamilyGroupsFilter>("all");

  const showCreated = filter === "all" || filter === "created";
  const showMemberships = filter === "all" || filter === "memberships";

  const hasCreated = (payload?.created_groups.length ?? 0) > 0;
  const hasMemberships = (payload?.memberships.length ?? 0) > 0;

  const hasVisibleGroups = useMemo(() => {
    if (!payload) return false;
    if (filter === "created") return hasCreated;
    if (filter === "memberships") return hasMemberships;
    return hasCreated || hasMemberships;
  }, [filter, hasCreated, hasMemberships, payload]);

  if (showSkeleton) {
    return <AdminTableSkeleton columns={1} rows={3} minWidth="sm" />;
  }

  if (error) {
    return <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage>;
  }

  if (!payload || (!hasCreated && !hasMemberships)) {
    return (
      <AdminUserProfileSectionEmptyState
        icon={UsersRound}
        title="No family groups yet"
        description="This user is not part of any family groups yet."
      />
    );
  }

  return (
    <div className="admin-user-family-groups-section space-y-5">
      <div className="admin-user-family-groups-section__head">
        <h2 className={PROFILE_SECTION_TITLE_CLASS}>Family groups</h2>
        <Select value={filter} onValueChange={(value) => setFilter(value as FamilyGroupsFilter)}>
          <SelectTrigger size="sm" className="min-w-[9.5rem]">
            <SelectValue placeholder="Filter groups" />
          </SelectTrigger>
          <SelectContent align="end">
            {FAMILY_GROUPS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasVisibleGroups ? (
        <p className="text-caption text-muted-foreground">No groups match this filter.</p>
      ) : null}

      {showCreated && hasCreated ? (
        <div className="admin-user-family-groups-section__block space-y-2.5">
          {filter === "all" ? (
            <p className="admin-user-family-groups-section__label">Groups Created</p>
          ) : null}
          <div className="admin-family-group-sub-card-grid">
            {payload.created_groups.map((group) => (
              <AdminFamilyGroupSubCard
                key={group.id}
                group={group}
                badgeLabel={group.status}
                badgeVariant={statusVariant(group.status)}
                meta={`${group.member_count} members · created ${formatTimestampDetail(group.created_at)}`}
                onOpen={() => router.push(userFamilyGroupDetailHref(profilePath, group.id))}
              />
            ))}
          </div>
        </div>
      ) : null}

      {showMemberships && hasMemberships ? (
        <div className="admin-user-family-groups-section__block space-y-2.5">
          {filter === "all" ? (
            <p className="admin-user-family-groups-section__label">Memberships</p>
          ) : null}
          <div className="admin-family-group-sub-card-grid">
            {payload.memberships.map((membership) => (
              <AdminFamilyGroupSubCard
                key={membership.group_id}
                group={membership}
                badgeLabel={membership.role}
                badgeKind={membership.role === "head" ? "head" : "status"}
                badgeVariant={roleVariant(membership.role)}
                meta={`${membership.member_count} members${
                  membership.badge_label ? ` · ${membership.badge_label}` : ""
                } · joined ${formatTimestampDetail(membership.joined_at)}`}
                onOpen={() => router.push(userFamilyGroupDetailHref(profilePath, membership.group_id))}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
