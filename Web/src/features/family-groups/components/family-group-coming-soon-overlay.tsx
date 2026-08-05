"use client";

import { Lock } from "lucide-react";

import { FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { cn } from "@/lib/utils";

type FamilyGroupComingSoonOverlayProps = {
  title: string;
  subtitle: string;
  className?: string;
};

export function FamilyGroupComingSoonOverlay({
  title,
  subtitle,
  className,
}: FamilyGroupComingSoonOverlayProps) {
  return (
    <div className={cn("absolute inset-0 z-20 flex items-center justify-center px-2", className)}>
      <div
        className={cn(
          FAMILY_GROUP_CARD_RADIUS_CLASS,
          "flex max-w-full items-center gap-3 border border-border bg-card/95 px-3.5 py-3 shadow-zynd-mid backdrop-blur-sm sm:px-4",
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Lock className="size-4 text-primary" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-compact font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
