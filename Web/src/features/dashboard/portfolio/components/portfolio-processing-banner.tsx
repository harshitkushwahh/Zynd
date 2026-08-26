"use client";

import { Clock } from "lucide-react";

import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

type PortfolioProcessingBannerProps = {
  title: string;
  description: string;
  className?: string;
};

export function PortfolioProcessingBanner({
  title,
  description,
  className,
}: PortfolioProcessingBannerProps) {
  return (
    <div
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "mb-4 border border-warning/20 bg-warning/5 p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Clock className="size-4" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-compact font-semibold text-foreground sm:text-body">{title}</h2>
          <p className="mt-1 text-caption leading-relaxed text-muted-foreground sm:text-compact">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
