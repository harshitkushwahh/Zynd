"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import { OverviewCompactCardHeader } from "@/features/dashboard/overview/components/overview-compact-card-header";
import { OverviewFamilyLockedPreview } from "@/features/dashboard/overview/components/overview-family-locked-preview";
import { useAuth } from "@/contexts/auth-context";
import {
  type FamilyGroupMemberPreview,
  type FamilyGroupSummary,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyMemberRoleChip } from "@/features/family-groups/components/family-member-role-badge";
import { useFamilyGroupQuery } from "@/features/family-groups/hooks/use-family-group-query";
import {
  useFamilyGroupGoalsQuery,
  useFamilyGroupPortfolioQuery,
} from "@/features/family-groups/hooks/use-family-group-dashboard-queries";
import { useFamilyGroupsQuery } from "@/features/family-groups/hooks/use-family-groups-query";
import { useFamilyGroupPinned } from "@/features/family-groups/hooks/use-family-group-pinned";
import { orderFamilyGroupsForTabs } from "@/features/family-groups/lib/family-group-tab-order";
import { buildFamilyGroupHrefFromList } from "@/features/family-groups/lib/family-group-navigation";
import { familyMemberInitials, pickPrimaryFamilyGoal } from "@/features/family-groups/lib/family-group-ui";
import { formatInrOverview, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const FAMILY_HREF = "/dashboard/family";
const MEMBER_PREVIEW_LIMIT = 4;

const FAMILY_MEMBERS_FOOTER_CLASS =
  "mt-3 flex items-center justify-between gap-2 border-t border-border/45 pt-3";

function FamilyCardBodySkeleton() {
  const overview = copy.dashboard.overview;

  return (
    <>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 sm:gap-x-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-7 w-16 shrink-0 rounded-full" />
      </div>

      <div className="mt-4 rounded-[1.25rem] bg-muted/80 p-3.5 sm:p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {overview.familyPopoverMembers}
        </p>
        <div className="mt-2.5 flex min-h-[2.25rem] items-center">
          <div className="flex -space-x-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="size-9 rounded-full ring-2 ring-muted/60" />
            ))}
          </div>
        </div>
        <div className={FAMILY_MEMBERS_FOOTER_CLASS}>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
    </>
  );
}

function OverviewFamilyGroupRowSkeleton() {
  return (
    <div className="mt-3 flex items-center gap-2.5">
      <Skeleton className="size-10 rounded-full" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-1.5">
          <Skeleton className="size-1.5 rounded-full" />
          <Skeleton className="size-1.5 rounded-full" />
        </div>
      </div>
    </div>
  );
}

const GROUP_AVATAR_COLORS = [
  "bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  "bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:text-rose-300",
  "bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
];

function buildOverviewFamilyGroupHref(group: FamilyGroupSummary, groups: FamilyGroupSummary[]) {
  return buildFamilyGroupHrefFromList(group, groups);
}

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-muted-foreground",
  );
}

const GOAL_AMOUNT_MAX_PX = 34;
const GOAL_AMOUNT_MIN_PX = 11;

function FamilyHeroAmountDisplay({
  primaryAmount,
  secondaryAmount,
  noGoalLabel,
}: {
  primaryAmount: number | null;
  secondaryAmount: number | null;
  noGoalLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const showSplit = secondaryAmount != null && secondaryAmount > 0;
  const showPrimaryOnly = !showSplit && primaryAmount != null && primaryAmount > 0;
  const showNoGoal = !showSplit && !showPrimaryOnly;

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fitText = () => {
      let size = GOAL_AMOUNT_MAX_PX;
      text.style.fontSize = `${size}px`;

      while (text.scrollWidth > container.clientWidth && size > GOAL_AMOUNT_MIN_PX) {
        size -= 0.5;
        text.style.fontSize = `${size}px`;
      }
    };

    fitText();
    const observer = new ResizeObserver(fitText);
    observer.observe(container);
    return () => observer.disconnect();
  }, [primaryAmount, secondaryAmount, noGoalLabel, showSplit, showPrimaryOnly, showNoGoal]);

  return (
    <div ref={containerRef} className="min-w-0 overflow-hidden">
      {showSplit ? (
        <p
          ref={textRef}
          className="w-max max-w-none whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums text-foreground"
          style={{ fontSize: GOAL_AMOUNT_MAX_PX }}
        >
          {formatInrOverview(primaryAmount ?? 0)}
          <span className="font-medium text-muted-foreground" style={{ fontSize: "0.58em" }}>
            {" "}
            / {formatInrOverview(secondaryAmount)}
          </span>
        </p>
      ) : showPrimaryOnly ? (
        <p
          ref={textRef}
          className="w-max max-w-none whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums text-foreground"
          style={{ fontSize: GOAL_AMOUNT_MAX_PX }}
        >
          {formatInrOverview(primaryAmount)}
        </p>
      ) : (
        <p
          ref={textRef}
          className="w-max max-w-none whitespace-nowrap font-semibold leading-none tracking-tight text-muted-foreground"
          style={{ fontSize: GOAL_AMOUNT_MAX_PX }}
        >
          {noGoalLabel}
        </p>
      )}
    </div>
  );
}

function GroupLogo({
  group,
  colorIndex,
  size = "md",
}: {
  group: FamilyGroupSummary;
  colorIndex: number;
  size?: "sm" | "md";
}) {
  const initials = familyMemberInitials(group.title);
  const color = GROUP_AVATAR_COLORS[colorIndex % GROUP_AVATAR_COLORS.length];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1",
        size === "sm" ? "size-8" : "size-10",
        color,
      )}
    >
      {group.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={group.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        <span className={cn("font-semibold", size === "sm" ? "text-[10px]" : "text-caption")}>
          {initials}
        </span>
      )}
    </div>
  );
}

function GroupPaginationDots({
  count,
  activeIndex,
  onSelect,
}: {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  if (count <= 1) return null;

  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label="Family groups">
      {Array.from({ length: count }).map((_, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Group ${index + 1}`}
            onClick={() => onSelect(index)}
            className={cn(
              "rounded-full transition-all duration-200",
              active ? "size-2 bg-foreground" : "size-1.5 bg-muted-foreground/35 hover:bg-muted-foreground/55",
            )}
          />
        );
      })}
    </div>
  );
}

function MemberAvatar({ member }: { member: FamilyGroupMemberPreview }) {
  const isHead = member.role === "head";

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-2",
          isHead ? "ring-amber-300/50" : "ring-muted/60",
        )}
      >
        {member.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.profile_image_url} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-[10px] font-semibold">
            {familyMemberInitials(member.display_name)}
          </span>
        )}
      </div>
      {isHead ? (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-muted/80">
          <Crown className="size-2" strokeWidth={2.25} />
        </span>
      ) : null}
    </div>
  );
}

function MemberHoverAvatar({
  member,
  colorIndex,
  groupHref,
}: {
  member: FamilyGroupMemberPreview;
  colorIndex: number;
  groupHref: string;
}) {
  const overview = copy.dashboard.overview;
  const isHead = member.role === "head";
  const color = GROUP_AVATAR_COLORS[colorIndex % GROUP_AVATAR_COLORS.length];

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        closeDelay={280}
        render={
          <button
            type="button"
            className="relative z-10 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label={member.display_name}
          />
        }
      >
        <MemberAvatar member={member} />
      </HoverCardTrigger>

      <HoverCardContent
        side="top"
        align="center"
        sideOffset={10}
        className="w-52 rounded-[1.25rem] p-0"
      >
        <Link
          href={groupHref}
          className="group/popover relative block rounded-[inherit] p-3 outline-none transition-colors duration-200 hover:bg-muted/35 focus-visible:bg-muted/35"
          aria-label={overview.familyPopoverOpenAria.replace("{name}", member.display_name)}
        >
          <ArrowUpRight className="absolute right-3 top-3 size-3.5 text-muted-foreground transition-colors duration-200 group-hover/popover:text-primary" />

          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div
                className={cn(
                  "flex size-14 items-center justify-center overflow-hidden rounded-full ring-1",
                  isHead ? "ring-amber-300/50" : "ring-border/70",
                  color,
                )}
              >
                {member.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.profile_image_url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-body font-semibold">
                    {familyMemberInitials(member.display_name)}
                  </span>
                )}
              </div>
              {isHead ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-popover">
                  <Crown className="size-2.5" strokeWidth={2.25} />
                </span>
              ) : null}
            </div>

            <p className="mt-2.5 max-w-full truncate pr-5 text-compact font-semibold text-foreground">
              {member.display_name}
            </p>
            {member.display_nickname ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {member.display_nickname}
              </p>
            ) : null}

            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
              <FamilyMemberRoleChip role={member.role} />
              {member.badge_label ? (
                <Badge
                  variant="outline"
                  className="h-auto px-2 py-1 text-[10px] font-semibold leading-none"
                >
                  {member.badge_label}
                </Badge>
              ) : null}
            </div>
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
  const { user } = useAuth();
  const { pinnedGroupId } = useFamilyGroupPinned(user?.id);
  const { data, showSkeleton: groupsLoading, errorMessage: groupsError } = useFamilyGroupsQuery();
  const groups = useMemo(() => {
    const active = data?.items.filter((group) => group.status === "active") ?? [];
    return orderFamilyGroupsForTabs(active, pinnedGroupId);
  }, [data, pinnedGroupId]);

  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  useEffect(() => {
    if (activeGroupIndex >= groups.length) {
      setActiveGroupIndex(Math.max(0, groups.length - 1));
    }
  }, [activeGroupIndex, groups.length]);

  const activeGroup = groups[activeGroupIndex] ?? null;
  const activeGroupId = activeGroup?.id ?? null;
  const groupHref = activeGroup ? buildOverviewFamilyGroupHref(activeGroup, groups) : FAMILY_HREF;

  const { group: groupDetail, showSkeleton: detailLoading } = useFamilyGroupQuery(activeGroupId);
  const { portfolio, showSkeleton: portfolioLoading } = useFamilyGroupPortfolioQuery(activeGroupId);
  const { goals, showSkeleton: goalsLoading } = useFamilyGroupGoalsQuery(activeGroupId);

  const activeGoal = useMemo(() => pickPrimaryFamilyGoal(goals), [goals]);
  const goalTarget = activeGoal?.target_amount_inr ?? 0;
  const hasGoal = Boolean(activeGoal);

  const members = groupDetail?.members ?? [];
  const memberCount = members.length > 0 ? members.length : activeGroup?.member_count ?? 0;
  const membersBadgeLabel = overview.familyMembers.replace("{count}", String(memberCount));
  const previewMembers = members.slice(0, MEMBER_PREVIEW_LIMIT);
  const remainingMembers = Math.max(members.length - previewMembers.length, 0);

  const currentValue =
    portfolio?.total_current_value_inr ?? groupDetail?.total_current_value_inr ?? 0;
  const investedValue = portfolio?.total_invested_inr ?? groupDetail?.total_invested_inr ?? 0;
  const returnPct =
    investedValue > 0 ? ((currentValue - investedValue) / investedValue) * 100 : null;
  const returnDisplay = formatSignedReturn(returnPct);

  const heroPrimaryAmount = hasGoal ? currentValue : currentValue > 0 ? currentValue : null;
  const heroSecondaryAmount = hasGoal ? goalTarget : null;

  const contentLoading =
    groupsLoading ||
    (Boolean(activeGroupId) && (detailLoading || portfolioLoading || goalsLoading));
  const isLocked = !groupsLoading && groups.length === 0;

  return (
    <section
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      {isLocked ? (
        <div className="relative flex flex-col">
          <OverviewCompactCardHeader
            title={overview.familyTitle}
            href={FAMILY_HREF}
            ariaLabel={overview.familyViewAll}
          />
          <div className="relative mt-3 flex flex-col">
            <div className="pointer-events-none flex flex-col select-none blur-[5px]">
              <OverviewFamilyLockedPreview />
            </div>
            <OverviewLockedCardBackdrop />
            <OverviewLockedCardOverlay
              title={overview.familyTitle}
              subtitle={overview.familyEmpty}
            />
          </div>
        </div>
      ) : (
        <>
          <OverviewCompactCardHeader
            title={overview.familyTitle}
            href={activeGroup ? groupHref : undefined}
            ariaLabel={activeGroup ? overview.familyViewAll : undefined}
          />

          {groupsLoading || !activeGroup ? (
            <OverviewFamilyGroupRowSkeleton />
          ) : (
            <div className="mt-3 flex min-w-0 items-center gap-2.5">
              <GroupLogo group={activeGroup} colorIndex={activeGroupIndex} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-compact font-semibold text-foreground">{activeGroup.title}</p>
                <div className="mt-1.5">
                  <GroupPaginationDots
                    count={groups.length}
                    activeIndex={activeGroupIndex}
                    onSelect={setActiveGroupIndex}
                  />
                </div>
              </div>
            </div>
          )}

          {contentLoading ? (
            <FamilyCardBodySkeleton />
          ) : groups.length > 0 ? (
            <>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 sm:gap-x-3">
                <FamilyHeroAmountDisplay
                  primaryAmount={heroPrimaryAmount}
                  secondaryAmount={heroSecondaryAmount}
                  noGoalLabel={overview.familyNoGoal}
                />

                {returnPct != null && (heroPrimaryAmount != null || heroSecondaryAmount != null) ? (
                  <span
                    className={cn(
                      "inline-flex h-7 shrink-0 self-center items-center gap-0.5 rounded-full px-2.5 text-[11px] font-semibold tabular-nums",
                      toneClass(returnDisplay.tone),
                      returnDisplay.tone === "positive" && "bg-success/15",
                      returnDisplay.tone === "negative" && "bg-destructive/15",
                      returnDisplay.tone === "muted" && "bg-muted",
                    )}
                  >
                    {returnDisplay.tone === "positive" ? (
                      <ArrowUp className="size-3" strokeWidth={2.5} />
                    ) : returnDisplay.tone === "negative" ? (
                      <ArrowDown className="size-3" strokeWidth={2.5} />
                    ) : null}
                    {returnDisplay.tone === "positive"
                      ? `${returnPct.toFixed(2)}%`
                      : returnDisplay.text}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 rounded-[1.25rem] bg-muted/80 p-3.5 sm:p-4">
                {groupsError ? (
                  <FieldMessage variant="error" message={groupsError} />
                ) : (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {overview.familyPopoverMembers}
                    </p>
                    <div className="mt-2.5 flex min-h-[2.25rem] items-center">
                      <div className="flex items-center -space-x-2">
                        {previewMembers.map((member) => (
                          <MemberHoverAvatar
                            key={member.user_id}
                            member={member}
                            colorIndex={activeGroupIndex}
                            groupHref={groupHref}
                          />
                        ))}
                      </div>
                      {remainingMembers > 0 ? (
                        <span className="relative z-10 ml-1 flex size-9 items-center justify-center rounded-full bg-success text-[11px] font-semibold tabular-nums text-success-foreground ring-2 ring-muted">
                          +{remainingMembers}
                        </span>
                      ) : null}
                    </div>
                    <div className={FAMILY_MEMBERS_FOOTER_CLASS}>
                      <Badge
                        variant="secondary"
                        className="h-auto rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none tabular-nums"
                      >
                        {membersBadgeLabel}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

export function OverviewFamilyCardSkeleton({ className }: { className?: string }) {
  const overview = copy.dashboard.overview;

  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
      aria-busy="true"
      aria-label={overview.familyTitle}
    >
      <OverviewCompactCardHeader title={overview.familyTitle} />
      <OverviewFamilyGroupRowSkeleton />
      <FamilyCardBodySkeleton />
    </section>
  );
}
