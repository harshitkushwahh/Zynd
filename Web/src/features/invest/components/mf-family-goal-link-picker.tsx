"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, Loader2, Lock, Plus, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { fetchFamilyGroupGoals, fetchFamilyGroups } from "@/features/family-groups/api/family-groups-api";
import { familyMemberInitials } from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type FamilyLinkChoice = {
  familyGroupId: string;
  familyGroupTitle: string;
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
  confirmEntireFolio?: boolean;
  saving?: boolean;
};

type MfFamilyGoalLinkPickerProps = {
  value: FamilyLinkChoice;
  onChange: (value: FamilyLinkChoice) => void;
  disabled?: boolean;
  lockedLink?: { groupTitle: string; goalTitle: string | null } | null;
  confirmEntireFolio?: boolean;
  className?: string;
};

const DUMMY_FAMILY_GROUP = {
  title: "Sharma Family",
  initials: "SF",
} as const;

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
        <img src={avatarUrl!} alt="" className="size-full object-cover" onError={() => setImageFailed(true)} />
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
  return `${value.familyGroupTitle} · ${copy.goals.familyLinkPortfolioOnly}`;
}

export function MfFamilyLinkDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  confirmEntireFolio = false,
  saving = false,
}: MfFamilyLinkDialogProps) {
  const [groups, setGroups] = useState<FamilyLinkGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(value?.familyGroupId ?? null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(value?.goalId ?? null);
  const [linkEnabled, setLinkEnabled] = useState(value != null);

  useEffect(() => {
    if (!open) return;
    setSelectedGroupId(value?.familyGroupId ?? null);
    setSelectedGoalId(value?.goalId ?? null);
    setLinkEnabled(value != null);
  }, [open, value]);

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
  const moving =
    value != null && selectedGroupId != null && value.familyGroupId !== selectedGroupId && linkEnabled;

  function confirm() {
    if (!linkEnabled || !selectedGroup) {
      onConfirm(null);
      onOpenChange(false);
      return;
    }
    const goal = selectedGroup.goals.find((item) => item.id === selectedGoalId) ?? null;
    onConfirm({
      familyGroupId: selectedGroup.id,
      familyGroupTitle: selectedGroup.title,
      goalId: goal?.id ?? null,
      goalTitle: goal?.title ?? null,
    });
    onOpenChange(false);
  }

  return (
    <BrandDialog open={open} onOpenChange={onOpenChange} title={copy.goals.familyLinkDialogTitle} maxWidth="md">
      <div className="space-y-4 px-6 py-5">
        <p className="text-compact text-muted-foreground">{copy.goals.familyLinkDialogDescription}</p>
        <p className="text-caption text-muted-foreground">{copy.goals.familyLinkVisibility}</p>
        {loading ? (
          <div className="flex items-center gap-2 text-compact text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.goals.linkableFamilyGoalsLoading}
          </div>
        ) : error ? (
          <FieldMessage variant="error" message={error} />
        ) : groups.length === 0 ? (
          <p className="text-compact text-muted-foreground">{copy.goals.linkableFamilyGoalsEmpty}</p>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setLinkEnabled(false);
                setSelectedGroupId(null);
                setSelectedGoalId(null);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[var(--radius-control)] border px-3 py-2 text-left",
                !linkEnabled ? "border-primary/40 bg-primary/10" : "border-border/70",
              )}
            >
              <span className="text-compact font-medium">{copy.goals.linkableFamilyGoalsNone}</span>
            </button>
            {groups.map((group) => {
              const selected = linkEnabled && selectedGroupId === group.id;
              return (
                <div
                  key={group.id}
                  className={cn(
                    "rounded-[var(--radius-card)] border px-3 py-2.5",
                    selected ? "border-primary/40 bg-primary/5" : "border-border/70",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 text-left"
                    onClick={() => {
                      setLinkEnabled(true);
                      setSelectedGroupId(group.id);
                      setSelectedGoalId(null);
                    }}
                  >
                    <FamilyGroupCircle label={group.title} avatarUrl={group.avatarUrl} />
                    <span className="min-w-0 flex-1 truncate text-compact font-medium">{group.title}</span>
                  </button>
                  {selected ? (
                    <div className="mt-2 space-y-1 pl-10">
                      {group.goals.length === 0 ? (
                        <p className="text-caption text-muted-foreground">{copy.goals.familyLinkNoGoals}</p>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 text-caption">
                            <input
                              type="radio"
                              name={`family-link-${group.id}`}
                              checked={selectedGoalId == null}
                              onChange={() => setSelectedGoalId(null)}
                            />
                            {copy.goals.familyLinkPortfolioOnly}
                          </label>
                          {group.goals.map((goal) => (
                            <label key={goal.id} className="flex items-center gap-2 text-caption">
                              <input
                                type="radio"
                                name={`family-link-${group.id}`}
                                checked={selectedGoalId === goal.id}
                                onChange={() => setSelectedGoalId(goal.id)}
                              />
                              {goal.title}
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {confirmEntireFolio && linkEnabled ? (
          <p className="text-caption text-muted-foreground">{copy.goals.familyLinkEntireFolio}</p>
        ) : null}
        {moving ? <p className="text-caption text-muted-foreground">{copy.goals.familyLinkMoveWarning}</p> : null}
        <BrandDialogFooter>
          <Button type="button" onClick={confirm} disabled={saving || loading}>
            {saving ? copy.goals.familyLinkSaving : copy.goals.familyLinkConfirm}
          </Button>
        </BrandDialogFooter>
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
  confirmEntireFolio = false,
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

  if (!lockedLink && hasGroups === false) {
    return <FamilyGoalLinkLockedEmpty className={className} />;
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || Boolean(lockedLink)}
        onClick={() => setOpen(true)}
        className="h-auto w-full justify-start gap-2.5 rounded-[var(--radius-card)] px-3 py-2.5 text-left font-normal"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground ring-1 ring-border">
          <Target className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-compact font-medium text-foreground">{label}</span>
        {lockedLink ? null : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
      </Button>
      <MfFamilyLinkDialog
        open={open}
        onOpenChange={setOpen}
        value={value}
        onConfirm={onChange}
        confirmEntireFolio={confirmEntireFolio}
      />
    </div>
  );
}
