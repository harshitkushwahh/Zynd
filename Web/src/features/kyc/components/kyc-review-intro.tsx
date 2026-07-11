"use client";

import { ListChecks } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycReviewIntroProps = {
  className?: string;
};

export function KycReviewIntro({ className }: KycReviewIntroProps) {
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-3 text-center", className)}>
      <div
        className={cn(
          "flex size-[3.25rem] items-center justify-center rounded-full",
          "bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/20",
        )}
      >
        <ListChecks className="size-[1.35rem]" strokeWidth={2} aria-hidden />
      </div>

      <div className="max-w-xs space-y-1">
        {copy.kyc.review.descriptionLines.map((line) => (
          <p key={line} className="text-caption leading-relaxed text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
