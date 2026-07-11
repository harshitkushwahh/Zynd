"use client";

import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";

type KycReviewNomineeEmptyProps = {
  onAddNominee: () => void;
};

export function KycReviewNomineeEmpty({ onAddNominee }: KycReviewNomineeEmptyProps) {
  return (
    <div className="space-y-3 py-1">
      <div className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/[0.06] px-3 py-3">
        <p className="text-caption font-semibold text-foreground">{copy.kyc.review.nominee.emptyTitle}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {copy.kyc.review.nominee.emptyDescription}
        </p>
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAddNominee}>
        <UserPlus className="size-4" strokeWidth={2} />
        {copy.kyc.review.nominee.addNominee}
      </Button>
    </div>
  );
}
