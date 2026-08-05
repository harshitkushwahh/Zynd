"use client";

import { Crown } from "lucide-react";

import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type AdminFamilyGroupRoleBadgeKind = "head" | "status";

type AdminFamilyGroupRoleBadgeProps = {
  label: string;
  kind: AdminFamilyGroupRoleBadgeKind;
  statusVariant?: StatusBadgeVariant;
  className?: string;
};

export function AdminFamilyGroupRoleBadge({
  label,
  kind,
  statusVariant = "neutral",
  className,
}: AdminFamilyGroupRoleBadgeProps) {
  const normalized = label.trim().toLowerCase();

  if (kind === "head") {
    return (
      <span className={cn("admin-family-group-role-badge admin-family-group-role-badge--head", className)}>
        <Crown className="admin-family-group-role-badge__icon" strokeWidth={2.25} />
        <span>{label}</span>
      </span>
    );
  }

  if (normalized === "active") {
    return (
      <span className={cn("admin-family-group-role-badge admin-family-group-role-badge--active", className)}>
        <span className="admin-family-group-role-badge__dot" aria-hidden />
        <span>{label}</span>
      </span>
    );
  }

  if (normalized === "archived") {
    return (
      <span className={cn("admin-family-group-role-badge admin-family-group-role-badge--archived", className)}>
        <span>{label}</span>
      </span>
    );
  }

  return (
    <StatusBadge variant={statusVariant} showIcon={false} className={className}>
      {label}
    </StatusBadge>
  );
}
