"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Crown, Lock } from "lucide-react";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { OrbitingCircles } from "@/components/ui/orbiting-circles";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";
import {
  FamilyMemberRoleChip,
  FamilyRelationshipChip,
} from "@/features/family-groups/components/family-member-role-badge";
import {
  computeFamilyOrbitMetrics,
  familyMemberInitials,
  familyMemberRoleName,
  getFamilyOrbitActiveRingCount,
  orbitMemberTagLabel,
  orbitMemberTagStyle,
  pickOrbitMembers,
  splitOrbitMembersByRing,
  type FamilyOrbitRingConfig,
} from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupOrbitVisualProps = {
  members: FamilyGroupMemberPreview[];
  currentUserId?: string | null;
  selectedMemberId?: string | null;
  onMemberSelect?: (memberId: string) => void;
  onInviteMember?: () => void;
  canInvite?: boolean;
  className?: string;
};

type OrbitAvatarSize = "center" | "member";

const ORBIT_EMPTY_SLOT_ANGLES = [-45, 135] as const;
const ORBIT_TOOLTIP_DELAY = 0;
const ORBIT_TOOLTIP_CLOSE_DELAY = 120;
const ORBIT_ACTIVE_Z_CLASS = "z-50";
const ORBIT_TOOLTIP_CONTENT_CLASS = cn(
  "z-[100] block w-fit rounded-md bg-foreground text-xs text-background",
  "dark:bg-card dark:text-card-foreground dark:ring-1 dark:ring-border/40",
  "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
);
const ORBIT_TOOLTIP_ARROW_CLASS = cn(
  "z-50 size-2.5 rotate-45 rounded-[2px] bg-white fill-white",
  "data-[side=top]:-bottom-2.5",
);

type OrbitTooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "collisionBoundary" | "collisionPadding"
  >;

function OrbitTooltipContent({
  className,
  side = "top",
  sideOffset = 10,
  align = "center",
  alignOffset = 0,
  collisionBoundary = "viewport",
  collisionPadding = 16,
  children,
  ...props
}: OrbitTooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(ORBIT_TOOLTIP_CONTENT_CLASS, className)}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className={ORBIT_TOOLTIP_ARROW_CLASS} />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

function useOrbitContainerSize(defaultSize = 280) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(defaultSize);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize(Math.max(Math.min(width, height), 160));
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { containerRef, size };
}

const ORBIT_AVATAR_SIZE: Record<
  OrbitAvatarSize,
  { outer: string; text: string; crown: string; crownIcon: string }
> = {
  center: {
    outer: "size-14 sm:size-16",
    text: "text-[11px] sm:text-xs",
    crown: "size-4 sm:size-5",
    crownIcon: "size-2 sm:size-2.5",
  },
  member: {
    outer: "size-full",
    text: "text-[11px]",
    crown: "size-5",
    crownIcon: "size-2.5",
  },
};

function HeadCrownBadge({ size }: { size: OrbitAvatarSize }) {
  const sizing = ORBIT_AVATAR_SIZE[size];
  return (
    <span
      className={cn(
        "absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-zynd-mid",
        sizing.crown,
      )}
    >
      <Crown className={sizing.crownIcon} strokeWidth={2.25} />
    </span>
  );
}

function OrbitMemberTag({
  member,
  size,
}: {
  member: FamilyGroupMemberPreview;
  size: OrbitAvatarSize;
}) {
  const label = orbitMemberTagLabel(member);
  if (!label) return null;

  const style = orbitMemberTagStyle(member);

  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-0 left-1/2 z-20 flex max-w-[calc(100%+1.25rem)] -translate-x-1/2 translate-y-1/2 items-center gap-1 rounded-full border px-1.5 py-0.5 shadow-zynd-low backdrop-blur-[2px]",
        size === "center" ? "text-[10px]" : "text-[9px]",
        style.pillClass,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", style.dotClass)} aria-hidden />
      <span className="truncate font-semibold leading-none">{label}</span>
    </span>
  );
}

function MemberOrbitAvatarCircle({
  member,
  size,
  selected = false,
}: {
  member: FamilyGroupMemberPreview;
  size: OrbitAvatarSize;
  selected?: boolean;
}) {
  const sizing = ORBIT_AVATAR_SIZE[size];

  return (
    <div className={cn("relative overflow-visible", size === "member" && "size-full")}>
      {size === "center" ? (
        <div className="absolute -inset-1.5 rounded-full bg-[color-mix(in_srgb,var(--zynd-blue)_10%,transparent)] blur-md" />
      ) : null}
      <div
        className={cn(
          "relative overflow-hidden rounded-full transition-[box-shadow,ring-color,ring-offset-color] duration-300 ease-out motion-reduce:transition-none",
          sizing.outer,
          size === "center"
            ? cn(
                "bg-gradient-to-br from-primary/20 to-[color-mix(in_srgb,var(--zynd-emerald)_35%,transparent)] ring-2 shadow-[0_0_28px_color-mix(in_srgb,var(--zynd-emerald)_35%,transparent)]",
                selected
                  ? "ring-primary-foreground/80 shadow-[0_0_32px_color-mix(in_srgb,var(--zynd-emerald)_55%,transparent)]"
                  : "ring-[color-mix(in_srgb,var(--zynd-emerald)_55%,transparent)]",
              )
            : cn(
                "ring-2 shadow-[0_0_24px_color-mix(in_srgb,var(--zynd-emerald)_35%,transparent)]",
                selected
                  ? "ring-primary-foreground/80 shadow-[0_0_28px_color-mix(in_srgb,var(--zynd-emerald)_55%,transparent)]"
                  : "ring-primary-foreground/25",
              ),
        )}
      >
        {member.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.profile_image_url} alt="" className="size-full object-cover" />
        ) : (
          <div
            className={cn(
              "flex size-full items-center justify-center bg-card font-semibold text-primary",
              sizing.text,
            )}
          >
            {familyMemberInitials(member.display_name)}
          </div>
        )}
      </div>
      {member.role === "head" ? <HeadCrownBadge size={size} /> : null}
      <OrbitMemberTag member={member} size={size} />
    </div>
  );
}

function OrbitMemberTooltipContent({
  member,
  isCurrentUser = false,
}: {
  member: FamilyGroupMemberPreview;
  isCurrentUser?: boolean;
}) {
  const isHead = member.role === "head";

  return (
    <div className="flex min-w-[11rem] items-start gap-3 text-left">
      <div className="relative shrink-0">
        <div className="size-10 overflow-hidden rounded-full ring-2 ring-background/25 dark:ring-border/40">
          {member.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.profile_image_url} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted text-[11px] font-semibold text-muted-foreground dark:bg-secondary dark:text-secondary-foreground">
              {familyMemberInitials(member.display_name)}
            </div>
          )}
        </div>
        {isHead ? <HeadCrownBadge size="member" /> : null}
      </div>
      <div className="min-w-0 space-y-1.5">
        <div>
          <p className="font-semibold leading-tight">
            {isCurrentUser ? "You" : member.display_name}
          </p>
          {isCurrentUser ? (
            <p className="text-[11px] opacity-70">{member.display_name}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FamilyMemberRoleChip role={member.role} surface="tooltip" />
          {member.badge_label ? (
            <FamilyRelationshipChip label={member.badge_label} surface="tooltip" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildOrbitTooltipLabel(member: FamilyGroupMemberPreview, isCurrentUser = false) {
  return [
    isCurrentUser ? "You" : member.display_name,
    familyMemberRoleName(member.role),
    member.badge_label,
  ]
    .filter(Boolean)
    .join(", ");
}

function OrbitMemberTooltip({
  member,
  isCurrentUser,
  selected = false,
  onSelect,
  onHoverChange,
  onOpenChange,
  children,
}: {
  member: FamilyGroupMemberPreview;
  isCurrentUser: boolean;
  selected?: boolean;
  onSelect?: (memberId: string) => void;
  onHoverChange?: (hovering: boolean) => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip
      onOpenChange={(open) => {
        onOpenChange?.(open);
      }}
    >
      <TooltipTrigger
        delay={ORBIT_TOOLTIP_DELAY}
        closeDelay={ORBIT_TOOLTIP_CLOSE_DELAY}
        closeOnClick={false}
        render={
          <button
            type="button"
            aria-label={buildOrbitTooltipLabel(member, isCurrentUser)}
            aria-pressed={selected}
            onClick={() => onSelect?.(member.user_id)}
            onPointerEnter={() => onHoverChange?.(true)}
            onPointerLeave={() => onHoverChange?.(false)}
            className={cn(
              "relative flex size-full cursor-pointer items-center justify-center overflow-visible rounded-full outline-none transition-[box-shadow,ring-color,ring-offset-color] duration-300 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-primary-foreground/40",
              selected && "ring-2 ring-primary-foreground/70 ring-offset-2 ring-offset-transparent",
            )}
          >
            {children}
          </button>
        }
      />
      <OrbitTooltipContent
        side="top"
        align="center"
        sideOffset={10}
        collisionBoundary="viewport"
        collisionPadding={16}
        className="max-w-none px-3.5 py-3"
      >
        <OrbitMemberTooltipContent member={member} isCurrentUser={isCurrentUser} />
      </OrbitTooltipContent>
    </Tooltip>
  );
}

function OrbitMemberAvatar({
  member,
  currentUserId,
  selected = false,
  onSelect,
  onHoverChange,
  onOpenChange,
}: {
  member: FamilyGroupMemberPreview;
  currentUserId?: string | null;
  selected?: boolean;
  onSelect?: (memberId: string) => void;
  onHoverChange?: (hovering: boolean) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const isCurrentUser = member.user_id === currentUserId;

  return (
    <OrbitMemberTooltip
      member={member}
      isCurrentUser={isCurrentUser}
      selected={selected}
      onSelect={onSelect}
      onHoverChange={onHoverChange}
      onOpenChange={onOpenChange}
    >
      <MemberOrbitAvatarCircle member={member} size="member" selected={selected} />
    </OrbitMemberTooltip>
  );
}

function CenterHub({
  member,
  isCurrentUser,
  isActive,
  selected = false,
  onSelect,
  onHoverChange,
  onOpenChange,
}: {
  member: FamilyGroupMemberPreview;
  isCurrentUser: boolean;
  isActive?: boolean;
  selected?: boolean;
  onSelect?: (memberId: string) => void;
  onHoverChange?: (hovering: boolean) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <div className={cn("relative pointer-events-auto", isActive ? ORBIT_ACTIVE_Z_CLASS : "z-40")}>
      <OrbitMemberTooltip
        member={member}
        isCurrentUser={isCurrentUser}
        selected={selected}
        onSelect={onSelect}
        onHoverChange={onHoverChange}
        onOpenChange={onOpenChange}
      >
        <MemberOrbitAvatarCircle member={member} size="center" selected={selected} />
      </OrbitMemberTooltip>
    </div>
  );
}

function orbitSlotPosition(angleDeg: number, radius: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    left: `calc(50% + ${Math.cos(radians) * radius}px)`,
    top: `calc(50% + ${Math.sin(radians) * radius}px)`,
  };
}

function OrbitEmptySlot({
  angle,
  radius,
  slotSize,
  canInvite = false,
  onInvite,
}: {
  angle: number;
  radius: number;
  slotSize: number;
  canInvite?: boolean;
  onInvite?: () => void;
}) {
  const position = orbitSlotPosition(angle, radius);
  const tooltipCopy = copy.familyGroups.dashboard.orbitEmptySlotTooltip;

  return (
    <Tooltip>
      <TooltipTrigger
        delay={ORBIT_TOOLTIP_DELAY}
        closeDelay={ORBIT_TOOLTIP_CLOSE_DELAY}
        render={
          <button
            type="button"
            aria-label={tooltipCopy}
            disabled={!canInvite}
            onClick={() => {
              if (canInvite) onInvite?.();
            }}
            style={{
              ...position,
              width: slotSize,
              height: slotSize,
            }}
            className={cn(
              "absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none transition-[box-shadow,background-color,border-color] duration-300 ease-out motion-reduce:transition-none",
              "border border-primary-foreground/20 bg-white shadow-zynd-low",
              canInvite
                ? "cursor-pointer hover:border-primary-foreground/35 hover:shadow-zynd-mid focus-visible:ring-2 focus-visible:ring-primary-foreground/35"
                : "cursor-default opacity-90",
            )}
          >
            <Lock className="size-4 text-[color-mix(in_srgb,var(--zynd-navy)_72%,var(--foreground))]" strokeWidth={2.25} />
          </button>
        }
      />
      <OrbitTooltipContent
        side="top"
        align="center"
        sideOffset={10}
        collisionBoundary="viewport"
        collisionPadding={16}
        className="max-w-[14rem] px-3 py-2 text-center text-[11px] leading-relaxed"
      >
        {tooltipCopy}
      </OrbitTooltipContent>
    </Tooltip>
  );
}

function OrbitEmptySlots({
  center,
  currentUserId,
  selectedMemberId,
  onMemberSelect,
  canInvite,
  onInviteMember,
  className,
}: {
  center: FamilyGroupMemberPreview;
  currentUserId?: string | null;
  selectedMemberId?: string | null;
  onMemberSelect?: (memberId: string) => void;
  canInvite?: boolean;
  onInviteMember?: () => void;
  className?: string;
}) {
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
  const [openTooltipMemberId, setOpenTooltipMemberId] = useState<string | null>(null);
  const activeMemberId = openTooltipMemberId ?? hoveredMemberId;
  const { containerRef, size } = useOrbitContainerSize();
  const metrics = computeFamilyOrbitMetrics(size, 1);

  return (
    <TooltipProvider delay={ORBIT_TOOLTIP_DELAY} closeDelay={ORBIT_TOOLTIP_CLOSE_DELAY}>
      <div
        ref={containerRef}
        className={cn(
          "relative isolate mx-auto aspect-square w-full max-w-full overflow-hidden",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(ellipse_120%_100%_at_50%_50%,color-mix(in_srgb,var(--zynd-blue)_4%,transparent)_0%,transparent_72%)]" />

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary-foreground/22"
          style={{
            width: metrics.firstRingRadius * 2,
            height: metrics.firstRingRadius * 2,
          }}
        />

        {ORBIT_EMPTY_SLOT_ANGLES.map((angle) => (
          <OrbitEmptySlot
            key={angle}
            angle={angle}
            radius={metrics.firstRingRadius}
            slotSize={metrics.emptySlotSize}
            canInvite={canInvite}
            onInvite={onInviteMember}
          />
        ))}

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <CenterHub
            member={center}
            isCurrentUser={center.user_id === currentUserId}
            isActive={activeMemberId === center.user_id}
            selected={center.user_id === selectedMemberId}
            onSelect={onMemberSelect}
            onHoverChange={(hovering) => {
              setHoveredMemberId((current) => {
                if (hovering) return center.user_id;
                return current === center.user_id ? null : current;
              });
            }}
            onOpenChange={(open) => {
              setOpenTooltipMemberId((current) => {
                if (open) return center.user_id;
                return current === center.user_id ? null : current;
              });
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

function OrbitRing({
  members,
  ring,
  currentUserId,
  selectedMemberId,
  onMemberSelect,
  activeMemberId,
  orbitPaused,
  onHoverChange,
  onTooltipOpenChange,
}: {
  members: FamilyGroupMemberPreview[];
  ring: FamilyOrbitRingConfig;
  currentUserId?: string | null;
  selectedMemberId?: string | null;
  onMemberSelect?: (memberId: string) => void;
  activeMemberId: string | null;
  orbitPaused: boolean;
  onHoverChange: (memberId: string, hovering: boolean) => void;
  onTooltipOpenChange: (memberId: string, open: boolean) => void;
}) {
  if (members.length === 0) return null;

  const ringActive = members.some((member) => member.user_id === activeMemberId);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0",
        ringActive ? ORBIT_ACTIVE_Z_CLASS : ring.zClass,
      )}
    >
      <OrbitingCircles
        radius={ring.radius}
        duration={ring.duration}
        iconSize={ring.iconSize}
        startAngle={ring.startAngle}
        reverse={ring.reverse}
        path
        paused={orbitPaused}
        getOrbitItemClassName={(index) =>
          members[index]?.user_id === activeMemberId ? ORBIT_ACTIVE_Z_CLASS : "z-10"
        }
      >
        {members.map((member) => (
          <OrbitMemberAvatar
            key={member.user_id}
            member={member}
            currentUserId={currentUserId}
            selected={member.user_id === selectedMemberId}
            onSelect={onMemberSelect}
            onHoverChange={(hovering) => onHoverChange(member.user_id, hovering)}
            onOpenChange={(open) => onTooltipOpenChange(member.user_id, open)}
          />
        ))}
      </OrbitingCircles>
    </div>
  );
}

export function FamilyGroupOrbitVisual({
  members,
  currentUserId,
  selectedMemberId,
  onMemberSelect,
  onInviteMember,
  canInvite = false,
  className,
}: FamilyGroupOrbitVisualProps) {
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
  const [openTooltipMemberId, setOpenTooltipMemberId] = useState<string | null>(null);
  const { center, orbiting } = pickOrbitMembers(members, currentUserId);
  const [innerOrbit, middleOrbit, outerOrbit] = splitOrbitMembersByRing(orbiting);
  const activeRingCount = getFamilyOrbitActiveRingCount(
    innerOrbit.length,
    middleOrbit.length,
    outerOrbit.length,
  );
  const { containerRef, size } = useOrbitContainerSize();
  const metrics = computeFamilyOrbitMetrics(size, activeRingCount);
  const [innerRing, middleRing, outerRing] = metrics.rings;

  const activeMemberId = openTooltipMemberId ?? hoveredMemberId;
  const orbitPaused = activeMemberId !== null;

  function setMemberHovered(memberId: string, hovering: boolean) {
    setHoveredMemberId((current) => {
      if (hovering) return memberId;
      return current === memberId ? null : current;
    });
  }

  function setMemberTooltipOpen(memberId: string, open: boolean) {
    setOpenTooltipMemberId((current) => {
      if (open) return memberId;
      return current === memberId ? null : current;
    });
  }

  if (!center) {
    return (
      <div className={cn("flex w-full flex-1 items-center justify-center", className)}>
        <p className="text-compact text-primary-foreground/70">{copy.familyGroups.dashboard.orbitEmptyHint}</p>
      </div>
    );
  }

  if (orbiting.length === 0) {
    return (
      <OrbitEmptySlots
        center={center}
        currentUserId={currentUserId}
        selectedMemberId={selectedMemberId}
        onMemberSelect={onMemberSelect}
        canInvite={canInvite}
        onInviteMember={onInviteMember}
        className={className}
      />
    );
  }

  return (
    <TooltipProvider delay={ORBIT_TOOLTIP_DELAY} closeDelay={ORBIT_TOOLTIP_CLOSE_DELAY}>
      <div
        ref={containerRef}
        className={cn(
          "relative isolate mx-auto aspect-square w-full max-w-full overflow-hidden",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(ellipse_120%_100%_at_50%_50%,color-mix(in_srgb,var(--zynd-blue)_4%,transparent)_0%,transparent_72%)]" />

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <CenterHub
            member={center}
            isCurrentUser={center.user_id === currentUserId}
            isActive={activeMemberId === center.user_id}
            selected={center.user_id === selectedMemberId}
            onSelect={onMemberSelect}
            onHoverChange={(hovering) => setMemberHovered(center.user_id, hovering)}
            onOpenChange={(open) => setMemberTooltipOpen(center.user_id, open)}
          />
        </div>

        {innerRing && innerOrbit.length > 0 ? (
          <OrbitRing
            members={innerOrbit}
            ring={innerRing}
            currentUserId={currentUserId}
            selectedMemberId={selectedMemberId}
            onMemberSelect={onMemberSelect}
            activeMemberId={activeMemberId}
            orbitPaused={orbitPaused}
            onHoverChange={setMemberHovered}
            onTooltipOpenChange={setMemberTooltipOpen}
          />
        ) : null}
        {middleRing && middleOrbit.length > 0 ? (
          <OrbitRing
            members={middleOrbit}
            ring={middleRing}
            currentUserId={currentUserId}
            selectedMemberId={selectedMemberId}
            onMemberSelect={onMemberSelect}
            activeMemberId={activeMemberId}
            orbitPaused={orbitPaused}
            onHoverChange={setMemberHovered}
            onTooltipOpenChange={setMemberTooltipOpen}
          />
        ) : null}
        {outerRing && outerOrbit.length > 0 ? (
          <OrbitRing
            members={outerOrbit}
            ring={outerRing}
            currentUserId={currentUserId}
            selectedMemberId={selectedMemberId}
            onMemberSelect={onMemberSelect}
            activeMemberId={activeMemberId}
            orbitPaused={orbitPaused}
            onHoverChange={setMemberHovered}
            onTooltipOpenChange={setMemberTooltipOpen}
          />
        ) : null}

        <div className="pointer-events-none absolute left-[18%] top-[22%] z-0 size-2 rounded-full bg-amber-400/80 blur-[1px]" />
        <div className="pointer-events-none absolute right-[20%] top-[30%] z-0 size-1.5 rounded-full bg-sky-400/80 blur-[1px]" />
        <div className="pointer-events-none absolute bottom-[24%] left-[28%] z-0 size-1.5 rounded-full bg-emerald-400/80 blur-[1px]" />
        <div className="pointer-events-none absolute bottom-[18%] right-[24%] z-0 size-2 rounded-full bg-violet-400/70 blur-[1px]" />
      </div>
    </TooltipProvider>
  );
}
