"use client";

import { Crown, Eye, HandCoins, Tag, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { familyMemberRoleName } from "@/features/family-groups/lib/family-group-ui";
import { cn } from "@/lib/utils";

type RoleBadgeSurface = "default" | "hero" | "tooltip";

type FamilyMemberRoleBadgeProps = {
  role: string;
  badgeLabel?: string | null;
  className?: string;
  surface?: RoleBadgeSurface;
};

type RoleChipConfig = {
  icon: LucideIcon;
  label: string;
  className: Record<RoleBadgeSurface, string>;
};

function getRoleChipConfig(role: string): RoleChipConfig {
  if (role === "head") {
    return {
      icon: Crown,
      label: familyMemberRoleName("head"),
      className: {
        default: "border-amber-300 bg-amber-400 text-amber-950 hover:bg-amber-400",
        hero: "border-amber-300/60 bg-amber-400 text-amber-950 hover:bg-amber-400",
        tooltip: "border-amber-300/35 bg-amber-400/25 text-amber-50",
      },
    };
  }

  if (role === "contributor") {
    return {
      icon: HandCoins,
      label: familyMemberRoleName("contributor"),
      className: {
        default:
          "border-emerald-300/60 bg-emerald-500/12 text-emerald-800 hover:bg-emerald-500/16 dark:text-emerald-100",
        hero: "border-emerald-300/40 bg-[color-mix(in_srgb,var(--zynd-emerald)_24%,transparent)] text-emerald-50 hover:bg-[color-mix(in_srgb,var(--zynd-emerald)_30%,transparent)]",
        tooltip: "border-emerald-300/30 bg-emerald-400/20 text-emerald-50",
      },
    };
  }

  return {
    icon: Eye,
    label: familyMemberRoleName("viewer"),
    className: {
      default:
        "border-sky-300/55 bg-sky-500/10 text-sky-900 hover:bg-sky-500/14 dark:text-sky-100",
      hero: "border-sky-300/35 bg-[color-mix(in_srgb,var(--zynd-blue)_20%,transparent)] text-sky-50 hover:bg-[color-mix(in_srgb,var(--zynd-blue)_26%,transparent)]",
      tooltip: "border-sky-300/30 bg-sky-400/15 text-sky-50",
    },
  };
}

const RELATIONSHIP_BADGE_CLASS: Record<RoleBadgeSurface, string> = {
  default:
    "border-violet-300/50 bg-violet-500/10 text-violet-900 hover:bg-violet-500/14 dark:text-violet-100",
  hero: "border-violet-300/35 bg-[color-mix(in_srgb,var(--zynd-blue)_16%,transparent)] text-primary-foreground hover:bg-[color-mix(in_srgb,var(--zynd-blue)_22%,transparent)]",
  tooltip: "border-violet-300/25 bg-violet-400/15 text-violet-50",
};

function RoleChip({
  role,
  surface,
}: {
  role: string;
  surface: RoleBadgeSurface;
}) {
  const config = getRoleChipConfig(role);
  const Icon = config.icon;

  return (
    <Badge
      className={cn(
        "h-auto gap-1 px-2 py-1 text-[10px] font-semibold leading-none",
        config.className[surface],
      )}
    >
      <Icon className="size-3 shrink-0" strokeWidth={2.25} />
      {config.label}
    </Badge>
  );
}

function RelationshipChip({
  label,
  surface,
}: {
  label: string;
  surface: RoleBadgeSurface;
}) {
  return (
    <Badge
      className={cn(
        "h-auto gap-1 px-2 py-1 text-[10px] font-semibold leading-none",
        RELATIONSHIP_BADGE_CLASS[surface],
      )}
    >
      <Tag className="size-3 shrink-0" strokeWidth={2.25} />
      {label}
    </Badge>
  );
}

export function FamilyMemberRoleBadge({
  role,
  badgeLabel,
  className,
  surface = "default",
}: FamilyMemberRoleBadgeProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <RoleChip role={role} surface={surface} />
      {badgeLabel ? <RelationshipChip label={badgeLabel} surface={surface} /> : null}
    </div>
  );
}

export function FamilyMemberRoleChip({
  role,
  surface = "default",
  className,
}: {
  role: string;
  surface?: RoleBadgeSurface;
  className?: string;
}) {
  return (
    <span className={className}>
      <RoleChip role={role} surface={surface} />
    </span>
  );
}

export function FamilyRelationshipChip({
  label,
  surface = "default",
  className,
}: {
  label: string;
  surface?: RoleBadgeSurface;
  className?: string;
}) {
  return (
    <span className={className}>
      <RelationshipChip label={label} surface={surface} />
    </span>
  );
}
