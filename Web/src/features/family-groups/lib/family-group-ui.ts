import type {
  FamilyGoal,
  FamilyGroupMemberPreview,
  FamilyGroupRole,
} from "@/features/family-groups/api/family-groups-api";
import { ZYND_CARD_RADIUS_CLASS, ZYND_CONTROL_RADIUS_CLASS, ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";

export const FAMILY_GROUP_CARD_RADIUS_CLASS = ZYND_CARD_RADIUS_CLASS;
export const FAMILY_GROUP_HERO_RADIUS_CLASS = ZYND_3XL_RADIUS_CLASS;
export const FAMILY_GROUP_DASHBOARD_PANEL_CLASS =
  `overflow-hidden ${ZYND_3XL_RADIUS_CLASS} border border-border bg-card`;
export const FAMILY_GROUP_CONTROL_RADIUS_CLASS = ZYND_CONTROL_RADIUS_CLASS;
export const FAMILY_GROUP_HERO_GLASS_CLASS =
  "border border-primary-foreground/12 bg-[color-mix(in_srgb,var(--zynd-navy)_16%,transparent)] backdrop-blur-[5px]";
export const FAMILY_GROUP_HERO_INNER_GLASS_CLASS = `${FAMILY_GROUP_CONTROL_RADIUS_CLASS} border border-primary-foreground/14 bg-[color-mix(in_srgb,var(--zynd-navy)_10%,transparent)] backdrop-blur-[8px] shadow-zynd-low`;
export const FAMILY_GROUP_MEMBER_DETAIL_TRANSITION_CLASS =
  "animate-in fade-in duration-300 ease-out motion-reduce:animate-none";

/** Orbit-left layout: dark-navy top-left, bright blue mid-left, soft navy right. */
export const FAMILY_GROUP_HERO_GRADIENT_CLASS =
  "bg-[linear-gradient(125deg,color-mix(in_srgb,var(--zynd-navy)_24%,var(--zynd-blue-dark))_0%,color-mix(in_srgb,var(--zynd-blue)_84%,white)_16%,var(--zynd-blue)_32%,var(--zynd-blue-dark)_56%,color-mix(in_srgb,var(--zynd-navy)_38%,var(--zynd-blue-dark))_82%,color-mix(in_srgb,var(--zynd-navy)_52%,var(--zynd-blue-dark))_100%)]";

/** Layered sheen — navy top-left corner, blue lift mid-left, soft tint on the right. */
export const FAMILY_GROUP_HERO_OVERLAY_CLASS =
  "bg-[radial-gradient(ellipse_90%_80%_at_8%_12%,color-mix(in_srgb,var(--zynd-navy)_16%,var(--zynd-blue-dark))_0%,transparent_68%),radial-gradient(ellipse_80%_70%_at_24%_48%,color-mix(in_srgb,var(--primary-foreground)_9%,transparent)_0%,transparent_62%),radial-gradient(ellipse_55%_50%_at_92%_68%,color-mix(in_srgb,var(--zynd-navy)_8%,var(--zynd-blue-dark))_0%,transparent_75%),linear-gradient(125deg,color-mix(in_srgb,var(--primary-foreground)_5%,transparent)_0%,transparent_42%,transparent_100%)]";

export function familyMemberInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function familyMemberRoleName(role: FamilyGroupRole | string) {
  const normalized = role.trim().toLowerCase();
  const roles = copy.familyGroups.roles;
  if (normalized === "head") return roles.head;
  if (normalized === "contributor") return roles.contributor;
  if (normalized === "viewer") return roles.viewer;
  return roles.viewer;
}

export function familyRoleLabel(role: FamilyGroupRole | string, badgeLabel?: string | null) {
  if (badgeLabel) return badgeLabel;
  return familyMemberRoleName(role);
}

export function formatFamilyMemberDetailValue(
  value: string | number | null | undefined,
  options?: { empty?: string },
) {
  const empty = options?.empty ?? "—";
  if (value === null || value === undefined || value === "") return empty;
  return String(value);
}

type OrbitMemberTagStyle = {
  dotClass: string;
  pillClass: string;
};

const ORBIT_MEMBER_TAG_STYLES: Record<string, OrbitMemberTagStyle> = {
  head: {
    dotClass: "bg-amber-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-amber-400)_75%,transparent)]",
    pillClass:
      "border-amber-300/35 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-amber-50",
  },
  wife: {
    dotClass: "bg-violet-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-violet-400)_70%,transparent)]",
    pillClass:
      "border-violet-300/30 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-primary-foreground",
  },
  husband: {
    dotClass: "bg-violet-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-violet-400)_70%,transparent)]",
    pillClass:
      "border-violet-300/30 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-primary-foreground",
  },
  father: {
    dotClass: "bg-orange-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-orange-400)_70%,transparent)]",
    pillClass:
      "border-orange-300/35 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-orange-50",
  },
  mother: {
    dotClass: "bg-orange-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-orange-400)_70%,transparent)]",
    pillClass:
      "border-orange-300/35 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-orange-50",
  },
  son: {
    dotClass: "bg-sky-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-sky-400)_70%,transparent)]",
    pillClass:
      "border-sky-300/30 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-sky-50",
  },
  daughter: {
    dotClass: "bg-sky-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-sky-400)_70%,transparent)]",
    pillClass:
      "border-sky-300/30 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-sky-50",
  },
  sibling: {
    dotClass: "bg-emerald-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-emerald-400)_70%,transparent)]",
    pillClass:
      "border-emerald-300/30 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-emerald-50",
  },
  custom: {
    dotClass: "bg-primary-foreground/80 shadow-[0_0_6px_color-mix(in_srgb,var(--primary-foreground)_45%,transparent)]",
    pillClass:
      "border-primary-foreground/20 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-primary-foreground",
  },
  default: {
    dotClass: "bg-primary-foreground/70 shadow-[0_0_6px_color-mix(in_srgb,var(--primary-foreground)_35%,transparent)]",
    pillClass:
      "border-primary-foreground/20 bg-[color-mix(in_srgb,var(--zynd-navy)_92%,transparent)] text-primary-foreground",
  },
};

export function orbitMemberTagLabel(
  member: Pick<FamilyGroupMemberPreview, "role" | "badge_label">,
) {
  const badgeLabel = member.badge_label?.trim();
  if (badgeLabel) return badgeLabel;
  if (member.role === "head") return familyMemberRoleName("head");
  return null;
}

export function orbitMemberTagStyle(
  member: Pick<FamilyGroupMemberPreview, "role" | "badge_key">,
): OrbitMemberTagStyle {
  const badgeKey = member.badge_key?.trim().toLowerCase();
  if (badgeKey && badgeKey in ORBIT_MEMBER_TAG_STYLES) {
    return ORBIT_MEMBER_TAG_STYLES[badgeKey]!;
  }
  if (member.role === "head") return ORBIT_MEMBER_TAG_STYLES.head!;
  return ORBIT_MEMBER_TAG_STYLES.default!;
}

export function orbitMemberFilterLabel(
  member: FamilyGroupMemberPreview,
  currentUserId?: string | null,
) {
  if (member.user_id === currentUserId) return "You";
  const tagLabel = orbitMemberTagLabel(member);
  if (tagLabel) return tagLabel;
  const [firstName] = member.display_name.trim().split(/\s+/);
  return firstName || member.display_name;
}

export function formatRelativeActivityTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const FAMILY_ORBIT_RING_CAPACITY = [2, 6, 4] as const;

export const FAMILY_ORBIT_MAX_ORBITING = FAMILY_ORBIT_RING_CAPACITY.reduce(
  (total, count) => total + count,
  0,
);

export type FamilyOrbitRingConfig = {
  radius: number;
  startAngle: number;
  duration: number;
  iconSize: number;
  reverse: boolean;
  zClass: string;
};

export type FamilyOrbitMetrics = {
  containerSize: number;
  firstRingRadius: number;
  ringStep: number;
  iconSize: number;
  emptySlotSize: number;
  rings: FamilyOrbitRingConfig[];
};

const FAMILY_ORBIT_BASE = {
  firstRingRadius: 80,
  ringGap: 12,
  iconSize: 48,
  edgePadding: 14,
};

export function getFamilyOrbitActiveRingCount(
  innerCount: number,
  middleCount: number,
  outerCount: number,
): 1 | 2 | 3 {
  if (outerCount > 0) return 3;
  if (middleCount > 0) return 2;
  if (innerCount > 0) return 1;
  return 1;
}

export function computeFamilyOrbitMetrics(
  containerSize: number,
  activeRingCount: 1 | 2 | 3,
): FamilyOrbitMetrics {
  const safeSize = Math.max(containerSize, 160);
  const ringStep = FAMILY_ORBIT_BASE.iconSize + FAMILY_ORBIT_BASE.ringGap;
  const outerRadius = FAMILY_ORBIT_BASE.firstRingRadius + ringStep * (activeRingCount - 1);
  const baseExtent = outerRadius + FAMILY_ORBIT_BASE.iconSize / 2 + FAMILY_ORBIT_BASE.edgePadding;
  const availableRadius = safeSize / 2 - 6;
  const scale = Math.min(1, availableRadius / baseExtent);

  const firstRingRadius = FAMILY_ORBIT_BASE.firstRingRadius * scale;
  const scaledRingStep = ringStep * scale;
  const iconSize = Math.max(32, Math.round(FAMILY_ORBIT_BASE.iconSize * scale));
  const emptySlotSize = Math.max(30, Math.round(iconSize * 0.92));

  const ringDefinitions = [
    { startAngle: 0, duration: 45, reverse: false, zClass: "z-10" },
    { startAngle: 30, duration: 58, reverse: true, zClass: "z-20" },
    { startAngle: 45, duration: 72, reverse: false, zClass: "z-30" },
  ] as const;

  const rings = ringDefinitions.slice(0, activeRingCount).map((definition, index) => ({
    ...definition,
    radius: firstRingRadius + scaledRingStep * index,
    iconSize,
  }));

  return {
    containerSize: safeSize,
    firstRingRadius,
    ringStep: scaledRingStep,
    iconSize,
    emptySlotSize,
    rings,
  };
}

export function splitOrbitMembersByRing(members: FamilyGroupMemberPreview[]) {
  let offset = 0;
  return FAMILY_ORBIT_RING_CAPACITY.map((capacity) => {
    const ring = members.slice(offset, offset + capacity);
    offset += capacity;
    return ring;
  });
}

export function pickOrbitMembers(
  members: FamilyGroupMemberPreview[],
  currentUserId?: string | null,
) {
  const head = members.find((member) => member.role === "head") ?? members[0];
  const self = members.find((member) => member.user_id === currentUserId);
  const center = self ?? head ?? members[0];
  const orbiting = members
    .filter((member) => member.user_id !== center?.user_id)
    .slice(0, FAMILY_ORBIT_MAX_ORBITING);
  return { center, orbiting };
}

/** Highest-priority active family goal for dashboard hero (priority 1 = top / pinned). */
export function pickPrimaryFamilyGoal(goals: FamilyGoal[]): FamilyGoal | null {
  const active = goals.filter((goal) => goal.status !== "archived");
  if (active.length === 0) return null;

  return [...active].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    const leftDate = new Date(left.target_date).getTime();
    const rightDate = new Date(right.target_date).getTime();
    if (leftDate !== rightDate) return leftDate - rightDate;
    return right.id.localeCompare(left.id);
  })[0]!;
}
