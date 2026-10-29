"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check, ChevronDown, Lock, Plus, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldMessage } from "@/components/ui/ui-message";
import { fetchFamilyGroupGoals, fetchFamilyGroups } from "@/features/family-groups/api/family-groups-api";
import {
  familyMemberInitials,
  zyndAvatarVariantForSeed,
} from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type FamilyLinkChoice = {
  familyGroupId: string;
  familyGroupTitle: string;
  familyGroupAvatarUrl?: string | null;
  goalId: string | null;
  goalTitle: string | null;
} | null;

type FamilyLinkGroup = {
  id: string;
  title: string;
  avatarUrl: string | null;
  goals: Array<{ id: string; title: string }>;
};

type MfFamilyLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: FamilyLinkChoice;
  onConfirm: (value: FamilyLinkChoice) => void;
  /** Folio link: pre-select every goal chip; user can turn goals off. */
  defaultSelectAllGoals?: boolean;
  saving?: boolean;
};

function goalIdsAllSelected(group: FamilyLinkGroup) {
  return new Set(group.goals.map((goal) => goal.id));
}

function resolveConfirmedGoal(
  group: FamilyLinkGroup,
  selectedGoalIds: Set<string>,
): { id: string; title: string } | null {
  const active = group.goals.filter((goal) => selectedGoalIds.has(goal.id));
  if (active.length !== 1) return null;
  return active[0] ?? null;
}

type MfFamilyGoalLinkPickerProps = {
  value: FamilyLinkChoice;
  onChange: (value: FamilyLinkChoice) => void;
  disabled?: boolean;
  lockedLink?: { groupTitle: string; goalTitle: string | null; groupAvatarUrl?: string | null } | null;
  className?: string;
};

const DUMMY_FAMILY_GROUP = {
  title: "Sharma Family",
  initials: "SF",
} as const;

const FAMILY_LINK_ILLUSTRATION_SRC = "/family-group-link.png";

function FamilyLinkGroupListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={copy.goals.linkableFamilyGoalsLoading}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[var(--radius-card)] border border-border/70 bg-card px-3 py-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 max-w-[11rem] flex-1" />
            <Skeleton className="size-5 shrink-0 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FamilyLinkPickerTriggerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border px-3 py-2.5",
        className,
      )}
      aria-busy="true"
      aria-label={copy.goals.linkableFamilyGoalsLoading}
    >
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <Skeleton className="h-4 min-w-0 flex-1" />
    </div>
  );
}

export function FamilyGroupCircle({
  label,
  avatarUrl,
  className,
  opaque = false,
}: {
  label: string;
  avatarUrl?: string | null;
  className?: string;
  /** Solid backing (no translucent tint) — use on photo cards and rich goal surfaces. */
  opaque?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedAvatarUrl = avatarUrl?.trim() ? avatarUrl.trim() : null;
  const showAvatar = Boolean(resolvedAvatarUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedAvatarUrl]);

  const initialsVariant = zyndAvatarVariantForSeed(label);

  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-inset ring-border/80",
        opaque
          ? showAvatar
            ? "bg-muted/40 ring-2 ring-white/85 shadow-md dark:ring-white/20"
            : "text-xs font-semibold ring-2 ring-white/70 shadow-md dark:ring-white/25"
          : showAvatar
            ? "bg-muted/50"
            : "bg-primary/10 text-xs font-semibold text-primary ring-primary/15",
        className,
      )}
      style={
        opaque && !showAvatar
          ? { backgroundColor: initialsVariant.bg, color: initialsVariant.fg }
          : undefined
      }
    >
      {showAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedAvatarUrl!}
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

function choiceLabel(value: FamilyLinkChoice) {
  if (!value) return copy.goals.linkableFamilyGoalsNone;
  if (value.goalTitle) return `${value.familyGroupTitle} · ${value.goalTitle}`;
  return `${value.familyGroupTitle} · ${copy.goals.familyLinkPortfolioShort}`;
}

function FamilyLinkIconChip({
  label,
  hint,
  selected,
  onClick,
  disabled,
  children,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const circleClass = cn(
    "flex size-11 items-center justify-center rounded-full border-2 transition-colors",
    selected
      ? "border-primary bg-primary/15 text-primary"
      : "border-border/70 bg-background text-muted-foreground hover:border-border hover:bg-muted/40",
  );
  const circleTitle = hint ?? label;

  return (
    <div className="flex max-w-[4.5rem] flex-col items-center gap-1">
      {onClick && !disabled ? (
        <button
          type="button"
          onClick={onClick}
          className={circleClass}
          title={circleTitle}
          aria-pressed={selected}
        >
          {children}
        </button>
      ) : (
        <div className={circleClass} title={circleTitle} aria-hidden={disabled}>
          {children}
        </div>
      )}
      <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function FamilyLinkGoalIconRow({
  goals,
  selectedGoalIds,
  onToggleGoalId,
}: {
  goals: Array<{ id: string; title: string }>;
  selectedGoalIds: Set<string>;
  onToggleGoalId: (goalId: string) => void;
}) {
  return (
    <div className="border-t border-border/60 bg-muted/10 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-center gap-3">
        <FamilyLinkIconChip
          label={copy.goals.familyLinkPortfolioShort}
          hint={copy.goals.familyLinkPortfolioIncludedHint}
          selected
          disabled
        >
          <Users className="size-5" aria-hidden />
        </FamilyLinkIconChip>
        {goals.map((goal) => {
          const goalSelected = selectedGoalIds.has(goal.id);
          return (
            <FamilyLinkIconChip
              key={goal.id}
              label={goal.title}
              selected={goalSelected}
              onClick={() => onToggleGoalId(goal.id)}
            >
              <span className="text-[11px] font-semibold leading-none">{familyMemberInitials(goal.title)}</span>
            </FamilyLinkIconChip>
          );
        })}
      </div>
    </div>
  );
}

export function MfFamilyLinkDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  defaultSelectAllGoals = false,
  saving = false,
}: MfFamilyLinkDialogProps) {
  const [groups, setGroups] = useState<FamilyLinkGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(value?.familyGroupId ?? null);
  const [selectedGoalIds, setSelectedGoalIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) return;
    setSelectedGroupId(value?.familyGroupId ?? null);
    if (value?.goalId) {
      setSelectedGoalIds(new Set([value.goalId]));
    } else {
      setSelectedGoalIds(new Set());
    }
  }, [open, value]);

  function selectGroupGoals(group: FamilyLinkGroup) {
    if (defaultSelectAllGoals && group.goals.length > 0) {
      setSelectedGoalIds(goalIdsAllSelected(group));
      return;
    }
    setSelectedGoalIds(new Set());
  }

  useEffect(() => {
    if (!open || !defaultSelectAllGoals || value?.goalId || !selectedGroupId) return;
    const group = groups.find((item) => item.id === selectedGroupId);
    if (!group?.goals.length) return;
    setSelectedGoalIds((current) => (current.size > 0 ? current : goalIdsAllSelected(group)));
  }, [open, defaultSelectAllGoals, groups, selectedGroupId, value?.goalId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetchFamilyGroups();
        const active = response.items.filter((group) => group.status === "active");
        const goalLists = await Promise.all(
          active.map(async (group) => {
            try {
              const goals = await fetchFamilyGroupGoals(group.id);
              return goals.items
                .filter((goal) => goal.status !== "archived")
                .map((goal) => ({ id: goal.id, title: goal.title }));
            } catch {
              return [];
            }
          }),
        );
        if (cancelled) return;
        setGroups(
          active.map((group, index) => ({
            id: group.id,
            title: group.title,
            avatarUrl: group.avatar_url ?? null,
            goals: goalLists[index] ?? [],
          })),
        );
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : copy.goals.linkableFamilyGoalsError);
        setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const moving = value != null && selectedGroupId != null && value.familyGroupId !== selectedGroupId;

  function toggleGoalId(goalId: string) {
    setSelectedGoalIds((current) => {
      const next = new Set(current);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }

  function confirm() {
    if (!selectedGroup) return;
    const goal = resolveConfirmedGoal(selectedGroup, selectedGoalIds);
    onConfirm({
      familyGroupId: selectedGroup.id,
      familyGroupTitle: selectedGroup.title,
      familyGroupAvatarUrl: selectedGroup.avatarUrl,
      goalId: goal?.id ?? null,
      goalTitle: goal?.title ?? null,
    });
    onOpenChange(false);
  }

  return (
    <BrandDialog open={open} onOpenChange={onOpenChange} title={copy.goals.familyLinkDialogTitle} maxWidth="md">
      <div className="flex max-h-[min(70vh,32rem)] flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4 pt-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src={FAMILY_LINK_ILLUSTRATION_SRC}
              alt=""
              width={200}
              height={125}
              sizes="160px"
              className="h-auto w-full max-w-[160px] object-contain"
            />
            <p className="max-w-sm text-caption leading-relaxed text-muted-foreground">
              {copy.goals.familyLinkDialogDescription}
            </p>
          </div>

          {loading ? (
            <FamilyLinkGroupListSkeleton rows={2} />
          ) : error ? (
            <FieldMessage variant="error" message={error} />
          ) : groups.length === 0 ? (
            <p className="text-center text-compact text-muted-foreground">{copy.goals.linkableFamilyGoalsEmpty}</p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => {
                const selected = selectedGroupId === group.id;
                const hasGoals = group.goals.length > 0;
                return (
                  <div
                    key={group.id}
                    className={cn(
                      "overflow-hidden rounded-[var(--radius-card)] border bg-card transition-[border-color,box-shadow]",
                      selected ? "border-primary/40 shadow-sm ring-1 ring-primary/10" : "border-border/70",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                        selected ? "bg-primary/[0.06]" : "hover:bg-muted/30",
                      )}
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        selectGroupGoals(group);
                      }}
                    >
                      <FamilyGroupCircle
                        label={group.title}
                        avatarUrl={group.avatarUrl}
                        className="size-10 text-xs"
                      />
                      <span className="min-w-0 flex-1 truncate text-compact font-semibold text-foreground">
                        {group.title}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-2">
                        {hasGoals ? (
                          <span
                            className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"
                            title={copy.goals.familyLinkHasGoalsHint}
                          >
                            <Target className="size-4" aria-hidden />
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full border transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/80 bg-background",
                          )}
                          aria-hidden
                        >
                          {selected ? <Check className="size-3" strokeWidth={2.5} /> : null}
                        </span>
                      </span>
                    </button>
                    {selected && hasGoals ? (
                      <FamilyLinkGoalIconRow
                        goals={group.goals}
                        selectedGoalIds={selectedGoalIds}
                        onToggleGoalId={toggleGoalId}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {moving ? <p className="text-caption text-muted-foreground">{copy.goals.familyLinkMoveWarning}</p> : null}
        </div>

        {groups.length > 0 ? (
          <BrandDialogFooter className="border-t border-border/70 sm:flex-col sm:justify-stretch">
            <Button
              type="button"
              className="w-full"
              onClick={confirm}
              disabled={saving || loading || !selectedGroupId}
            >
              {saving ? copy.goals.familyLinkSaving : copy.goals.familyLinkConfirm}
            </Button>
          </BrandDialogFooter>
        ) : null}
      </div>
    </BrandDialog>
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
      <div className="pointer-events-none flex select-none items-center gap-2.5 px-3 py-2.5 blur-[5px]" aria-hidden>
        <FamilyGroupCircle label={DUMMY_FAMILY_GROUP.title} />
        <p className="min-w-0 flex-1 truncate text-compact font-medium text-foreground">{DUMMY_FAMILY_GROUP.title}</p>
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
            <span className="font-semibold text-foreground">{copy.goals.linkableFamilyGoalsEmptyTitle}</span>
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
  value,
  onChange,
  disabled = false,
  lockedLink = null,
  className,
}: MfFamilyGoalLinkPickerProps) {
  const [open, setOpen] = useState(false);
  const [hasGroups, setHasGroups] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchFamilyGroups()
      .then((response) => {
        if (!cancelled) setHasGroups(response.items.some((group) => group.status === "active"));
      })
      .catch(() => {
        if (!cancelled) setHasGroups(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = useMemo(() => {
    if (lockedLink) {
      return lockedLink.goalTitle
        ? `${lockedLink.groupTitle} · ${lockedLink.goalTitle}`
        : lockedLink.groupTitle;
    }
    return choiceLabel(value);
  }, [lockedLink, value]);

  if (hasGroups === null) {
    return <FamilyLinkPickerTriggerSkeleton className={className} />;
  }

  if (!lockedLink && hasGroups === false) {
    return <FamilyGoalLinkLockedEmpty className={className} />;
  }

  const groupTitle = lockedLink?.groupTitle ?? value?.familyGroupTitle ?? "";
  const groupAvatarUrl = lockedLink?.groupAvatarUrl ?? value?.familyGroupAvatarUrl ?? null;

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || Boolean(lockedLink)}
        onClick={() => setOpen(true)}
        className="h-auto w-full justify-start gap-2.5 rounded-[var(--radius-card)] px-3 py-2.5 text-left font-normal"
      >
        {groupTitle ? (
          <FamilyGroupCircle label={groupTitle} avatarUrl={groupAvatarUrl} className="size-8 text-[10px]" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground ring-1 ring-border">
            <Target className="size-3.5" aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-compact font-medium text-foreground">{label}</span>
        {lockedLink ? null : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
      </Button>
      <MfFamilyLinkDialog
        open={open}
        onOpenChange={setOpen}
        value={value}
        onConfirm={onChange}
      />
    </div>
  );
}
