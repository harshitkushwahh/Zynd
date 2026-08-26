"use client";

import { Archive, Loader2, PencilLine, Pin, Plus, UsersRound } from "lucide-react";

import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";
import { orderFamilyGroupsForTabs } from "@/features/family-groups/lib/family-group-tab-order";
import { familyGroupTabLabel } from "@/features/family-groups/lib/family-group-slug";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupTabsProps = {
  groups: FamilyGroupSummary[];
  selectedGroupId?: string | null;
  pinnedGroupId?: string | null;
  loadingGroupId?: string | null;
  onSelect: (groupId: string) => void;
  onTogglePin?: (groupId: string) => void;
  onEditGroup?: (groupId: string) => void;
  onViewArchived?: () => void;
  onCreate?: () => void;
  canCreate?: boolean;
  className?: string;
};

export function FamilyGroupTabs({
  groups,
  selectedGroupId,
  pinnedGroupId = null,
  loadingGroupId = null,
  onSelect,
  onTogglePin,
  onEditGroup,
  onViewArchived,
  onCreate,
  canCreate = false,
  className,
}: FamilyGroupTabsProps) {
  if (groups.length === 0 && !onViewArchived && !(canCreate && onCreate)) {
    return null;
  }

  const orderedGroups = orderFamilyGroupsForTabs(groups, pinnedGroupId);

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <div
        role="tablist"
        aria-label={copy.familyGroups.pageTitle}
        className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
      >
        {orderedGroups.map((group) => {
          const selected = group.id === selectedGroupId;
          const pinned = group.id === pinnedGroupId;
          const switching = loadingGroupId === group.id;

          return (
            <div
              key={group.id}
              className={cn(
                "relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200",
                selected
                  ? "border-[color-mix(in_srgb,var(--zynd-emerald)_45%,transparent)] bg-[color-mix(in_srgb,var(--zynd-emerald)_12%,transparent)] text-foreground shadow-zynd-low"
                  : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:bg-muted/30 hover:text-foreground",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                aria-busy={switching && selected}
                onClick={() => onSelect(group.id)}
                className={cn(
                  "inline-flex max-w-[12rem] items-center gap-2 py-2 text-caption font-medium",
                  onEditGroup && group.my_role === "head" ? "pl-2 pr-1" : "pl-2 pr-2.5",
                  !onTogglePin && !(onEditGroup && group.my_role === "head") && "pr-2.5",
                )}
              >
                <span
                  className={cn(
                    "relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-inset transition-colors",
                    selected
                      ? "bg-primary/10 text-primary ring-[color-mix(in_srgb,var(--zynd-emerald)_35%,transparent)]"
                      : "bg-muted/50 text-muted-foreground ring-border/80",
                  )}
                >
                  {group.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={group.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    <UsersRound className="size-3.5" strokeWidth={2} />
                  )}
                  {switching && selected ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-[1px]">
                      <Loader2
                        className="size-3.5 animate-spin text-primary motion-reduce:animate-none"
                        aria-hidden
                      />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 truncate">{familyGroupTabLabel(group)}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    selected
                      ? "bg-background/60 text-foreground"
                      : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  {group.member_count}
                </span>
              </button>

              {onEditGroup && group.my_role === "head" ? (
                <button
                  type="button"
                  aria-label={copy.familyGroups.dashboard.editGroup}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditGroup(group.id);
                  }}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                    selected
                      ? "text-foreground hover:bg-muted hover:text-foreground"
                      : "text-muted-foreground/45 hover:bg-muted/40 hover:text-muted-foreground",
                  )}
                >
                  <PencilLine className="size-3.5" strokeWidth={2.25} />
                </button>
              ) : null}

              {onTogglePin ? (
                <button
                  type="button"
                  aria-label={
                    pinned ? copy.familyGroups.dashboard.unpinGroup : copy.familyGroups.dashboard.pinGroup
                  }
                  aria-pressed={pinned}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePin(group.id);
                  }}
                  className={cn(
                    "mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                    pinned
                      ? selected
                        ? "text-primary hover:bg-primary/10"
                        : "text-primary/45 hover:bg-primary/5 hover:text-primary/70"
                      : selected
                        ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                        : "text-muted-foreground/45 hover:bg-muted/40 hover:text-muted-foreground",
                  )}
                >
                  <Pin className={cn("size-3.5", pinned && "fill-current")} strokeWidth={2.25} />
                </button>
              ) : (
                <span className="w-1 shrink-0" aria-hidden />
              )}
            </div>
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

      {onViewArchived ? (
        <button
          type="button"
          aria-label={copy.familyGroups.dashboard.viewArchivedGroups}
          onClick={onViewArchived}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-zynd-low transition-colors hover:border-primary/25 hover:bg-muted/30 hover:text-foreground"
        >
          <Archive className="size-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
