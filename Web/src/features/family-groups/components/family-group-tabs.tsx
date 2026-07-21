"use client";

import { Plus, UsersRound } from "lucide-react";

import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupTabsProps = {
  groups: FamilyGroupSummary[];
  selectedGroupId?: string | null;
  onSelect: (groupId: string) => void;
  onCreate?: () => void;
  canCreate?: boolean;
  className?: string;
};

export function FamilyGroupTabs({
  groups,
  selectedGroupId,
  onSelect,
  onCreate,
  canCreate = false,
  className,
}: FamilyGroupTabsProps) {
  if (groups.length === 0) return null;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {groups.map((group) => {
          const selected = group.id === selectedGroupId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-caption font-medium transition",
                selected
                  ? "border-[color-mix(in_srgb,var(--zynd-emerald)_45%,transparent)] bg-[color-mix(in_srgb,var(--zynd-emerald)_12%,transparent)] text-foreground shadow-zynd-low"
                  : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:bg-muted/30 hover:text-foreground",
              )}
              aria-pressed={selected}
            >
              <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                {group.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={group.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  <UsersRound className="size-3.5" strokeWidth={2} />
                )}
              </span>
              <span className="max-w-[9rem] truncate">{group.title}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {group.member_count}
              </span>
            </button>
          );
        })}

        {canCreate && onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-primary/30 bg-card px-3 py-2 text-caption font-medium text-primary transition hover:border-primary/50 hover:bg-primary/5"
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            {copy.familyGroups.createAction}
          </button>
        ) : null}
      </div>
    </div>
  );
}
