"use client";

import { LineChart } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfCatalogEmptyStateProps = {
  className?: string;
};

export function MfCatalogEmptyState({ className }: MfCatalogEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-24 text-center sm:py-28",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-16 items-center justify-center rounded-full",
          "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15",
        )}
      >
        <LineChart className="size-7" strokeWidth={2} aria-hidden />
      </div>

      <h2 className="mt-5 text-h4 font-semibold tracking-tight text-foreground">
        {copy.mutualFunds.catalogEmptyTitle}
      </h2>
      <p className="mt-2 max-w-md text-caption leading-relaxed text-muted-foreground">
        {copy.mutualFunds.catalogEmptyDescription}
      </p>
    </div>
  );
}
