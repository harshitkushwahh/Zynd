"use client";

import { ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";
import { familyMemberInitials } from "@/features/family-groups/lib/family-group-ui";
import { OVERVIEW_FAMILY_LOCKED_PREVIEW } from "@/features/dashboard/overview/lib/overview-locked-preview-data";
import { formatInrOverview, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const GROUP_AVATAR_COLOR = "bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300";

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-muted-foreground",
  );
}

function LockedMemberAvatar({
  name,
  isHead,
}: {
  name: string;
  isHead: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-2",
          isHead ? "ring-amber-300/50" : "ring-muted/60",
        )}
      >
        <span className="text-[10px] font-semibold">{familyMemberInitials(name)}</span>
      </div>
    </div>
  );
}

export function OverviewFamilyLockedPreview() {
  const overview = copy.dashboard.overview;
  const preview = OVERVIEW_FAMILY_LOCKED_PREVIEW;
  const returnDisplay = formatSignedReturn(preview.returnPct);
  const fakeGroup: FamilyGroupSummary = {
    id: "locked-family-group",
    title: preview.groupTitle,
    status: "active",
    created_by_user_id: "preview",
    member_count: preview.members.length,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };

  return (
    <>
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1",
            GROUP_AVATAR_COLOR,
          )}
        >
          <span className="text-caption font-semibold">
            {familyMemberInitials(fakeGroup.title)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-compact font-semibold text-foreground">{fakeGroup.title}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-foreground" />
            <span className="size-1.5 rounded-full bg-muted-foreground/35" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 sm:gap-x-3">
        <p className="truncate text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[2rem]">
          {formatInrOverview(preview.currentValueInr)}
          <span className="ml-1 text-[0.58em] font-medium text-muted-foreground">
            / {formatInrOverview(preview.goalTargetInr)}
          </span>
        </p>
        <span
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full bg-success/15 px-2.5 text-[11px] font-semibold tabular-nums",
            toneClass(returnDisplay.tone),
          )}
        >
          <ArrowUp className="size-3" strokeWidth={2.5} />
          {preview.returnPct.toFixed(2)}%
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {overview.familyInvestedLabel}
        </p>
        <p className="text-caption font-semibold tabular-nums text-foreground">
          {formatInrOverview(preview.investedInr)}
        </p>
      </div>

      <div className="mt-4 rounded-[1.25rem] bg-muted/80 p-3.5 sm:p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {overview.familyPopoverMembers}
        </p>
        <div className="mt-2.5 flex min-h-[2.25rem] items-center">
          <div className="flex items-center -space-x-2">
            {preview.members.map((member) => (
              <LockedMemberAvatar
                key={member.user_id}
                name={member.display_name}
                isHead={member.role === "head"}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 border-t border-border/45 pt-3">
          <Badge
            variant="secondary"
            className="h-auto rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none tabular-nums"
          >
            {overview.familyMembers.replace("{count}", String(preview.members.length))}
          </Badge>
        </div>
      </div>
    </>
  );
}
