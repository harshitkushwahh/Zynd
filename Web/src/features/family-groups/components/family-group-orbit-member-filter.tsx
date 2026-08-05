"use client";

import { useMemo } from "react";

import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";
import {
  orbitMemberFilterLabel,
  orbitMemberTagStyle,
} from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupOrbitMemberFilterProps = {
  members: FamilyGroupMemberPreview[];
  currentUserId?: string | null;
  selectedMemberId?: string | null;
  onSelect: (memberId: string) => void;
  className?: string;
};

function orderMembersForFilter(
  members: FamilyGroupMemberPreview[],
  currentUserId?: string | null,
) {
  return [...members].sort((left, right) => {
    if (left.user_id === currentUserId) return -1;
    if (right.user_id === currentUserId) return 1;
    if (left.role === "head") return -1;
    if (right.role === "head") return 1;
    return left.display_name.localeCompare(right.display_name);
  });
}

export function FamilyGroupOrbitMemberFilter({
  members,
  currentUserId,
  selectedMemberId,
  onSelect,
  className,
}: FamilyGroupOrbitMemberFilterProps) {
  const orderedMembers = useMemo(
    () => orderMembersForFilter(members, currentUserId),
    [members, currentUserId],
  );

  if (orderedMembers.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label={copy.familyGroups.dashboard.orbitMemberFilterLabel}
      className={cn(
        "flex w-full flex-wrap items-center justify-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]",
        className,
      )}
    >
      {orderedMembers.map((member) => {
        const selected = member.user_id === selectedMemberId;
        const label = orbitMemberFilterLabel(member, currentUserId);
        const dotClass = orbitMemberTagStyle(member).dotClass;

        return (
          <button
            key={member.user_id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(member.user_id)}
            className={cn(
              "inline-flex max-w-[8.5rem] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium leading-none transition-[background-color,border-color,color,box-shadow] duration-200 motion-reduce:transition-none",
              selected
                ? "border-primary-foreground/35 bg-primary-foreground/14 text-primary-foreground shadow-zynd-low"
                : "border-primary-foreground/15 bg-primary-foreground/5 text-primary-foreground/70 hover:border-primary-foreground/25 hover:bg-primary-foreground/10 hover:text-primary-foreground",
            )}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", dotClass)} aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
