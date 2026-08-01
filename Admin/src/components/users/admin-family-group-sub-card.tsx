"use client";

import { ChevronRight } from "lucide-react";

import { AdminFamilyGroupMemberAvatars } from "@/components/users/admin-family-group-member-avatars";
import { AdminFamilyGroupProgressRing } from "@/components/users/admin-family-group-progress-ring";
import { AdminFamilyGroupRoleBadge } from "@/components/users/admin-family-group-role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { AdminUserFamilyGroupCard } from "@/lib/family-groups-admin-api";
import { cn } from "@/lib/utils";

function groupInitials(title: string) {
  return title
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type AdminFamilyGroupSubCardProps = {
  group: AdminUserFamilyGroupCard;
  badgeLabel: string;
  badgeVariant?: StatusBadgeVariant;
  badgeKind?: "head" | "status";
  meta: string;
  onOpen?: () => void;
  className?: string;
};

export function AdminFamilyGroupSubCard({
  group,
  badgeLabel,
  badgeVariant = "neutral",
  badgeKind = "status",
  meta,
  onOpen,
  className,
}: AdminFamilyGroupSubCardProps) {
  const description =
    group.description?.trim() || `${group.member_count} member${group.member_count === 1 ? "" : "s"}`;

  return (
    <button
      type="button"
      className={cn("admin-family-group-sub-card", className)}
      onClick={onOpen}
      disabled={!onOpen}
    >
      <div className="admin-family-group-sub-card__header">
        <Avatar className="admin-family-group-sub-card__avatar size-12 shrink-0">
          {group.avatar_url ? <AvatarImage src={group.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-compact font-semibold">{groupInitials(group.title)}</AvatarFallback>
        </Avatar>

        <div className="admin-family-group-sub-card__copy min-w-0 flex-1">
          <div className="admin-family-group-sub-card__title-row">
            <p className="admin-family-group-sub-card__title truncate">{group.title}</p>
            <AdminFamilyGroupRoleBadge
              label={badgeLabel}
              kind={badgeKind}
              statusVariant={badgeVariant}
              className="shrink-0"
            />
          </div>
          <p className="admin-family-group-sub-card__description line-clamp-1">{description}</p>
        </div>

        <span className="admin-family-group-sub-card__chevron-wrap" aria-hidden>
          <ChevronRight className="admin-family-group-sub-card__chevron size-4" strokeWidth={2.25} />
        </span>
      </div>

      <div className="admin-family-group-sub-card__divider" aria-hidden />

      <div className="admin-family-group-sub-card__footer">
        <div className="admin-family-group-sub-card__footer-main">
          <AdminFamilyGroupMemberAvatars
            members={group.members_preview}
            maxVisible={4}
            totalCount={group.member_count}
          />
          <AdminFamilyGroupProgressRing
            progressPct={group.progress_pct}
            goalsCount={group.active_goals_count}
          />
        </div>
        <p className="admin-family-group-sub-card__meta">{meta}</p>
      </div>
    </button>
  );
}
