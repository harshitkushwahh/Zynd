"use client";

import { Clock3 } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupActivityEmptyStateProps = {
  className?: string;
  compact?: boolean;
};

export function FamilyGroupActivityEmptyState({
  className,
  compact = false,
}: FamilyGroupActivityEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 text-center",
        compact ? "py-6" : "py-10",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Clock3 className="size-5" strokeWidth={2} />
      </div>
      <p className="mt-3 text-compact font-semibold text-foreground">{copy.familyGroups.activity.emptyTitle}</p>
      <p className="mt-1 max-w-xs text-caption leading-relaxed text-muted-foreground">
        {copy.familyGroups.activity.emptyDescription}
      </p>
    </div>
  );
}
