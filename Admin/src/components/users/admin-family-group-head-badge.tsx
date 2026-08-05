"use client";

import { Crown } from "lucide-react";

import { cn } from "@/lib/utils";

type AdminFamilyGroupHeadBadgeProps = {
  className?: string;
  size?: "sm" | "md";
};

export function AdminFamilyGroupHeadBadge({
  className,
  size = "sm",
}: AdminFamilyGroupHeadBadgeProps) {
  return (
    <span
      className={cn(
        "admin-family-group-head-badge",
        size === "md" && "admin-family-group-head-badge--md",
        className,
      )}
      aria-hidden
      title="Family head"
    >
      <Crown className="admin-family-group-head-badge__icon" strokeWidth={2.25} />
    </span>
  );
}
