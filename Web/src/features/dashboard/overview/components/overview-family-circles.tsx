"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Plus, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  type FamilyGroupMemberPreview,
  type FamilyGroupSummary,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyMemberRoleChip } from "@/features/family-groups/components/family-member-role-badge";
import { useFamilyGroupQuery } from "@/features/family-groups/hooks/use-family-group-query";
import { useFamilyGroupsQuery } from "@/features/family-groups/hooks/use-family-groups-query";
import { familyMemberInitials } from "@/features/family-groups/lib/family-group-ui";
import { ZYND_CARD_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const CIRCLE_COLORS = [
  "bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  "bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:text-rose-300",
  "bg-cyan-500/15 text-cyan-700 ring-cyan-500/25 dark:text-cyan-300",
];

const PREVIEW_MEMBER_LIMIT = 3;

function MemberAvatar({ member }: { member: FamilyGroupMemberPreview }) {
  return (
    <div className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-2 ring-popover">
      {member.profile_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.profile_image_url} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold">
          {familyMemberInitials(member.display_name)}
        </span>
      )}
    </div>
  );
}

function GroupCirclePopover({
  group,
  index,
}: {
  group: FamilyGroupSummary;
  index: number;
}) {
  const overview = copy.dashboard.overview;
  const initials = familyMemberInitials(group.title);
  const color = CIRCLE_COLORS[index % CIRCLE_COLORS.length];
  const [open, setOpen] = useState(false);
  const { group: detail, showSkeleton: loading, errorMessage: error } = useFamilyGroupQuery(
    open ? group.id : null,
  );

  const members = detail?.members ?? [];
  const description = detail?.description?.trim() || group.description?.trim() || "";
  const role = detail?.my_role ?? group.my_role ?? "viewer";
  const tag = detail?.tag ?? group.tag;
  const totalMembers = detail?.member_count ?? group.member_count;
  const groupHref = `/dashboard/family?group=${group.id}`;

  const previewMembers = useMemo(
    () => members.slice(0, PREVIEW_MEMBER_LIMIT),
    [members],
  );
  const remainingMembers = Math.max(totalMembers - previewMembers.length, 0);

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        delay={200}
        closeDelay={280}
        render={
          <Link
            href={groupHref}
            className="group/circle flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label={group.title}
          />
        }
      >
        <span
          className={cn(
            "relative flex size-12 items-center justify-center rounded-full ring-1",
            "transition-[box-shadow,ring-color,transform] duration-300 ease-out motion-reduce:transition-none",
            "group-hover/circle:scale-[1.04] group-hover/circle:shadow-zynd-mid group-hover/circle:ring-primary/35",
            "group-focus-visible/circle:scale-[1.04] group-focus-visible/circle:ring-primary/35",
            color,
          )}
        >
          {group.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.avatar_url} alt="" className="size-full rounded-full object-cover" />
          ) : (
            <span className="text-caption font-semibold">{initials}</span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-card text-[9px] font-semibold tabular-nums text-foreground ring-1 ring-border">
            {group.member_count}
          </span>
        </span>
        <span className="w-full truncate text-center text-[11px] font-medium text-muted-foreground transition-colors duration-300 ease-out group-hover/circle:text-foreground">
          {group.title}
        </span>
      </HoverCardTrigger>

      <HoverCardContent side="bottom" align="center" sideOffset={10} className="w-64 p-0">
        <Link
          href={groupHref}
          className="group/popover relative block rounded-[inherit] p-3.5 outline-none transition-colors duration-200 hover:bg-muted/35 focus-visible:bg-muted/35"
          aria-label={overview.familyPopoverOpenAria.replace("{name}", group.title)}
        >
          <ArrowUpRight className="absolute right-3 top-3 size-3.5 text-muted-foreground transition-colors duration-200 group-hover/popover:text-primary" />

          <div className="flex flex-col items-center text-center">
            <div
              className={cn(
                "flex size-14 items-center justify-center overflow-hidden rounded-full ring-1",
                color,
              )}
            >
              {group.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-body font-semibold">{initials}</span>
              )}
            </div>
            <p className="mt-2.5 max-w-full truncate pr-5 text-compact font-semibold text-foreground">
              {group.title}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {description || overview.familyPopoverNoDescription}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
              <FamilyMemberRoleChip role={role} />
              {tag ? (
                <Badge
                  variant="outline"
                  className="h-auto px-2 py-1 text-[10px] font-semibold leading-none"
                >
                  {tag}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {overview.familyPopoverMembers}
            </p>
            {loading ? (
              <div className="mt-2.5 flex items-center justify-center -space-x-2">
                {Array.from({ length: 3 }).map((_, memberIndex) => (
                  <Skeleton key={memberIndex} className="size-8 rounded-full ring-2 ring-popover" />
                ))}
              </div>
            ) : error ? (
              <FieldMessage
                message={error || overview.familyPopoverLoadError}
                className="mt-2 text-center [&>div]:justify-center"
              />
            ) : (
              <div className="mt-2.5 flex items-center justify-center">
                <div className="flex items-center -space-x-2">
                  {previewMembers.map((member) => (
                    <MemberAvatar key={member.user_id} member={member} />
                  ))}
                  {remainingMembers > 0 ? (
                    <span className="relative z-10 flex size-8 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold tabular-nums text-foreground ring-2 ring-popover">
                      +{remainingMembers}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
}

type OverviewFamilyCirclesProps = {
  className?: string;
};

export function OverviewFamilyCircles({ className }: OverviewFamilyCirclesProps) {
  const overview = copy.dashboard.overview;
  const { data, showSkeleton } = useFamilyGroupsQuery();
  const groups = useMemo(
    () => data?.items.filter((group) => group.status === "active").slice(0, 4) ?? [],
    [data],
  );
  const loading = showSkeleton;

  return (
    <section
      className={cn(
        ZYND_CARD_RADIUS_CLASS,
        "flex min-h-[9.5rem] min-w-0 flex-1 flex-col overflow-visible border border-border bg-card p-3.5 shadow-zynd-low",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="flex size-7 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
            <UsersRound className="size-3.5" strokeWidth={2.25} />
          </span>
          <p className="text-caption font-semibold text-foreground">{overview.familyTitle}</p>
        </div>
        <Button
          variant="muted"
          size="sm"
          className="shrink-0"
          nativeButton={false}
          render={<Link href="/dashboard/family" />}
        >
          {overview.familyViewAll}
        </Button>
      </div>

      <div className="mt-3 flex flex-1 items-center overflow-visible">
        {loading ? (
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-1.5">
                <Skeleton className="size-12 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Link
            href="/dashboard/family"
            className="flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-border px-3 py-4 text-center transition-colors hover:border-primary/30 hover:bg-muted/20"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus className="size-4" strokeWidth={2.25} />
            </span>
            <p className="text-caption font-medium text-foreground">{overview.familyEmpty}</p>
          </Link>
        ) : (
          <div className="flex w-full items-start gap-2 overflow-visible pt-1">
            {groups.map((group, index) => (
              <GroupCirclePopover key={group.id} group={group} index={index} />
            ))}
            <Link
              href="/dashboard/family"
              className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 outline-none"
            >
              <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-border bg-muted/20 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                <Plus className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {overview.familyAdd}
              </span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
