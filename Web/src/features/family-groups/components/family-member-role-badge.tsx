"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type FamilyMemberRoleBadgeProps = {
  role: string;
  badgeLabel?: string | null;
  className?: string;
};

function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function FamilyMemberRoleBadge({ role, badgeLabel, className }: FamilyMemberRoleBadgeProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <StatusBadge variant="neutral" showIcon={false} className="h-5 px-2 text-[10px]">
        {formatRoleLabel(role)}
      </StatusBadge>
      {badgeLabel ? (
        <StatusBadge variant="info" showIcon={false} className="h-5 px-2 text-[10px]">
          {badgeLabel}
        </StatusBadge>
      ) : null}
    </div>
  );
}
