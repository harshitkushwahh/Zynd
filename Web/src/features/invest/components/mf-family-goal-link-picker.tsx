"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, Loader2, Lock, Plus, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  fetchLinkableFamilyGoals,
  type LinkableFamilyGoal,
} from "@/features/goals/api/goals-api";
import {
  fetchFamilyGroups,
} from "@/features/family-groups/api/family-groups-api";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { familyMemberInitials } from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFamilyGoalLinkPickerProps = {
  selectedGoalId: string | null;
  onSelect: (goalId: string | null) => void;
  disabled?: boolean;
  className?: string;
};

const DUMMY_FAMILY_GROUP = {
  title: "Sharma Family",
  initials: "SF",
} as const;

function goalLabel(goal: LinkableFamilyGoal) {
  return `${goal.group_title} · ${goal.goal_title}`;
}

function FamilyGroupCircle({
  label,
  avatarUrl,
  className,
}: {
  label: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showAvatar = Boolean(avatarUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-inset ring-border/80",
        showAvatar ? "bg-muted/50" : "bg-primary/10 text-[10px] font-semibold text-primary ring-primary/15",
        className,
      )}
    >
      {showAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl!}
          alt=""
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : label ? (
        familyMemberInitials(label)
      ) : (
        <Users className="size-3.5" />
      )}
    </div>
  );
}

function FamilyGoalLinkLockedEmpty({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-dashed border-border/80 bg-card",
        className,
      )}
    >
      <div
        className="pointer-events-none flex select-none items-center gap-2.5 px-3 py-2.5 blur-[5px]"
        aria-hidden
      >
        <FamilyGroupCircle label={DUMMY_FAMILY_GROUP.title} />
        <p className="min-w-0 flex-1 truncate text-compact font-medium text-foreground">
          {DUMMY_FAMILY_GROUP.title}
        </p>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </div>

      <div className="pointer-events-none absolute inset-0 sip-chart-overlay" aria-hidden />

      <div className="absolute inset-0 flex items-center justify-center px-2">
        <div className="flex h-9 w-full max-w-[20rem] items-center gap-2 px-2.5 shadow-zynd-mid backdrop-blur-sm sip-lock-panel">
          <div className="relative shrink-0">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-3" strokeWidth={2.25} />
            </div>
            <div className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
              <Plus className="size-2" strokeWidth={2.5} aria-hidden />
            </div>
          </div>
          <p className="min-w-0 flex-1 truncate text-[11px] leading-none text-muted-foreground">
            <span className="font-semibold text-foreground">
              {copy.goals.linkableFamilyGoalsEmptyTitle}
            </span>
            <span className="mx-1 text-border">·</span>
            {copy.goals.linkableFamilyGoalsEmpty}
          </p>
          <Link
            href="/dashboard/family"
            aria-label={copy.goals.linkableFamilyGoalsBrowseGroups}
            className="inline-flex shrink-0 items-center justify-center rounded-full p-1 text-primary transition-colors hover:bg-primary/10"
          >
            <ArrowUpRight className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function MfFamilyGoalLinkPicker({
  selectedGoalId,
  onSelect,
  disabled = false,
  className,
}: MfFamilyGoalLinkPickerProps) {
  const [items, setItems] = useState<LinkableFamilyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [linkableResponse, familyGroupsResponse] = await Promise.all([
          fetchLinkableFamilyGoals(),
          fetchFamilyGroups(),
        ]);
        if (cancelled) return;

        const avatarByGroupId = new Map(
          familyGroupsResponse.items.map((group) => [group.id, group.avatar_url ?? null]),
        );

        setItems(
          linkableResponse.items.map((item) => ({
            ...item,
            group_avatar_url:
              item.group_avatar_url ?? avatarByGroupId.get(item.group_id) ?? null,
          })),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : copy.goals.linkableFamilyGoalsError);
        setItems([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      selectedGoalId &&
      items.length > 0 &&
      !items.some((item) => item.goal_id === selectedGoalId)
    ) {
      onSelect(null);
    }
  }, [items, onSelect, selectedGoalId]);

  const createGroup = useMemo(
    () => items.find((item) => item.can_create_goals) ?? null,
    [items],
  );

  const selectedGoal = useMemo(
    () => items.find((item) => item.goal_id === selectedGoalId) ?? null,
    [items, selectedGoalId],
  );

  const triggerLabel = selectedGoal
    ? goalLabel(selectedGoal)
    : copy.goals.linkableFamilyGoalsNone;

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-card)] border border-border px-3 py-2.5 text-compact text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        {copy.goals.linkableFamilyGoalsLoading}
      </div>
    );
  }

  if (error) {
    return <FieldMessage variant="error" message={error} className={className} />;
  }

  if (items.length === 0) {
    return <FamilyGoalLinkLockedEmpty className={className} />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen} className={className}>
        <PopoverTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-auto w-full justify-start gap-2.5 rounded-[var(--radius-card)] px-3 py-2.5 text-left font-normal"
            />
          }
        >
          {selectedGoal ? (
            <FamilyGroupCircle
              label={selectedGoal.group_title}
              avatarUrl={selectedGoal.group_avatar_url}
            />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground ring-1 ring-border">
              <Target className="size-3.5" aria-hidden />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-compact font-medium text-foreground">
            {triggerLabel}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-[var(--anchor-width)] max-w-[min(22rem,calc(100vw-2rem))] gap-1 p-1.5"
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-left transition-colors",
              selectedGoalId === null
                ? "bg-primary/10 text-foreground"
                : "hover:bg-muted/60",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground ring-1 ring-border">
              <Target className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-compact font-medium">
              {copy.goals.linkableFamilyGoalsNone}
            </span>
          </button>

          {items.map((goal) => {
            const isSelected = selectedGoalId === goal.goal_id;
            return (
              <button
                key={goal.goal_id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelect(goal.goal_id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-left transition-colors",
                  isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/60",
                )}
              >
                <FamilyGroupCircle
                  label={goal.group_title}
                  avatarUrl={goal.group_avatar_url}
                />
                <span className="min-w-0 flex-1 truncate text-compact font-medium">
                  {goalLabel(goal)}
                </span>
              </button>
            );
          })}

          {createGroup ? (
            <div className="border-t border-border p-2">
              <Link
                href={buildFamilyGroupHref({
                  id: createGroup.group_id,
                  title: createGroup.group_title,
                })}
                className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-left text-compact font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => setOpen(false)}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                {copy.goals.linkableFamilyGoalsCreateHint}
              </Link>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
  );
}
