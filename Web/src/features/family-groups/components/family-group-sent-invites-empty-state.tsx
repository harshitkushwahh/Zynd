"use client";

import { Mail } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupSentInvitesEmptyStateProps = {
  className?: string;
};

export function FamilyGroupSentInvitesEmptyState({ className }: FamilyGroupSentInvitesEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="flex size-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Mail className="size-5" strokeWidth={2} />
      </div>
      <p className="mt-3 text-compact font-semibold text-foreground">{copy.familyGroups.invite.sentEmptyTitle}</p>
      <p className="mt-1 max-w-sm text-caption leading-relaxed text-muted-foreground">
        {copy.familyGroups.invite.sentEmptyDescription}
      </p>
    </div>
  );
}
