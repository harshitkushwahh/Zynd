"use client";

import Link from "next/link";
import { UsersRound } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupCardProps = {
  group: FamilyGroupSummary;
  className?: string;
};

export function FamilyGroupCard({ group, className }: FamilyGroupCardProps) {
  return (
    <Link
      href={buildFamilyGroupHref(group.id)}
      className={cn(
        "group block rounded-[var(--radius-card)] border border-border bg-gradient-to-br from-card via-card to-muted/15 p-4 shadow-zynd-low transition hover:border-primary/30 hover:shadow-zynd-mid",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          {group.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            <UsersRound className="size-5" strokeWidth={2} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-caption font-semibold text-foreground">{group.title}</h3>
            {group.tag ? (
              <StatusBadge variant="neutral" showIcon={false} className="h-5 px-2 text-[10px]">
                {group.tag}
              </StatusBadge>
            ) : null}
            {group.my_role === "head" ? (
              <StatusBadge variant="info" showIcon={false} className="h-5 px-2 text-[10px]">
                {copy.familyGroups.card.headBadge}
              </StatusBadge>
            ) : null}
          </div>

          {group.description ? (
            <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{group.description}</p>
          ) : null}

          <p className="mt-3 text-[11px] font-medium text-muted-foreground">
            {copy.familyGroups.card.members(group.member_count)}
          </p>
        </div>
      </div>
    </Link>
  );
}
