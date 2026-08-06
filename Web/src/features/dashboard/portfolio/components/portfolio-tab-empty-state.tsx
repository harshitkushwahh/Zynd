"use client";

import type { LucideIcon } from "lucide-react";

import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

type PortfolioTabEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
};

export function PortfolioTabEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: PortfolioTabEmptyStateProps) {
  return (
    <div
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "flex min-h-[320px] flex-col items-center justify-center border border-dashed border-border/80 bg-muted/10 px-6 py-12 text-center sm:min-h-[360px] sm:px-10",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
        <Icon className="size-6" strokeWidth={2.25} aria-hidden />
      </div>
      <h2 className="mt-5 max-w-md text-body font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-compact leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
