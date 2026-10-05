"use client";

import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";

type KycReviewNomineeEmptyProps = {
  variant?: "opted_out" | "none_added";
  onAddNominee: () => void;
};

export function KycReviewNomineeEmpty({
  variant = "opted_out",
  onAddNominee,
}: KycReviewNomineeEmptyProps) {
  const title =
    variant === "opted_out" ? copy.kyc.review.nominee.emptyTitle : copy.kyc.review.nominee.noneTitle;
  const description =
    variant === "opted_out"
      ? copy.kyc.review.nominee.emptyDescription
      : copy.kyc.review.nominee.noneDescription;

  return (
    <div className="space-y-3 py-1">
      <div className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/[0.06] px-3 py-3">
        <p className="text-caption font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAddNominee}>
        <UserPlus className="size-4" strokeWidth={2} />
        {copy.kyc.review.nominee.addNominee}
      </Button>
    </div>
  );
}
