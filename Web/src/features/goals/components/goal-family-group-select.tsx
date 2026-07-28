"use client";

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";

import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchFamilyGroups,
  type FamilyGroupSummary,
} from "@/features/family-groups/api/family-groups-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export const GOAL_FAMILY_GROUP_NONE = "none";

type GoalFamilyGroupSelectProps = {
  id: string;
  value: string;
  onValueChange: (groupId: string) => void;
  disabled?: boolean;
  variant?: "default" | "template-dialog";
};

function creatableFamilyGroups(groups: FamilyGroupSummary[]) {
  return groups.filter((group) => group.status === "active" && group.my_role === "head");
}

export function GoalFamilyGroupSelect({
  id,
  value,
  onValueChange,
  disabled = false,
  variant = "default",
}: GoalFamilyGroupSelectProps) {
  const [groups, setGroups] = useState<FamilyGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void fetchFamilyGroups()
      .then((response) => {
        if (cancelled) return;
        setGroups(creatableFamilyGroups(response.items));
      })
      .catch(() => {
        if (cancelled) return;
        setError(copy.goals.familyGroupSelectError);
        setGroups([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const options = groups;

  useEffect(() => {
    if (value !== GOAL_FAMILY_GROUP_NONE && !options.some((group) => group.id === value)) {
      onValueChange(GOAL_FAMILY_GROUP_NONE);
    }
  }, [onValueChange, options, value]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{copy.goals.familyGroupSelectLabel}</Label>
        <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 py-2 text-compact text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {copy.goals.familyGroupSelectLoading}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{copy.goals.familyGroupSelectLabel}</Label>
        <FieldMessage message={error} className="mt-0" />
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{copy.goals.familyGroupSelectLabel}</Label>
        <p className="text-compact text-muted-foreground">{copy.goals.familyGroupSelectEmpty}</p>
      </div>
    );
  }

  const isTemplateDialog = variant === "template-dialog";
  const noneLabel = isTemplateDialog
    ? copy.goals.familyGroupSelectNone
    : copy.goals.familyGroupSelectNonePersonal;
  const selectedLabel =
    value === GOAL_FAMILY_GROUP_NONE
      ? noneLabel
      : options.find((group) => group.id === value)?.title ?? noneLabel;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{copy.goals.familyGroupSelectLabel}</Label>
      <div className={cn("relative", isTemplateDialog && "w-full")}>
        {isTemplateDialog ? (
          <Users
            className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        ) : null}
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
          <SelectTrigger
            id={id}
            className={cn(isTemplateDialog && "h-10 !w-full pl-10")}
          >
            <SelectValue>{selectedLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GOAL_FAMILY_GROUP_NONE}>{noneLabel}</SelectItem>
            {options.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function resolveGoalFamilyGroupId(value: string) {
  return value === GOAL_FAMILY_GROUP_NONE ? undefined : value;
}
