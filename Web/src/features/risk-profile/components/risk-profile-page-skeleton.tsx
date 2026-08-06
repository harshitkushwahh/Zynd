"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  RISK_PROFILE_CARD_CLASS,
  RISK_PROFILE_HERO_GRADIENT_CLASS,
  RISK_PROFILE_HERO_RADIUS_CLASS,
  RISK_PROFILE_TOP_ROW_MIN_HEIGHT_CLASS,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { cn } from "@/lib/utils";

export function RiskProfilePageSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,4fr)_minmax(0,3fr)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <section
          className={cn(
            "relative overflow-hidden border border-primary-foreground/10 p-4 shadow-zynd-mid sm:p-5",
            RISK_PROFILE_TOP_ROW_MIN_HEIGHT_CLASS,
            RISK_PROFILE_HERO_RADIUS_CLASS,
            RISK_PROFILE_HERO_GRADIENT_CLASS,
          )}
        >
          <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-15" aria-hidden />
          <div className="relative z-10 space-y-3 sm:max-w-md">
            <Skeleton className="h-6 w-28 rounded-full bg-skeleton-on-brand" />
            <Skeleton className="h-8 w-full max-w-sm bg-skeleton-on-brand" />
            <Skeleton className="h-4 w-full max-w-xs bg-skeleton-on-brand" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-32 rounded-[var(--radius-control)] bg-skeleton-on-brand" />
              <Skeleton className="size-8 rounded-[var(--radius-control)] bg-skeleton-on-brand" />
            </div>
          </div>
        </section>

        <section className={cn(RISK_PROFILE_CARD_CLASS, "p-3 sm:p-4")}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-[4.5rem] w-full rounded-[var(--radius-control)]" />
        </section>

        <section className={cn(RISK_PROFILE_CARD_CLASS, "p-4 sm:p-5")}>
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
          <div className="mt-3 space-y-2">
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-[4.75rem] w-full rounded-[var(--radius-control)]" />
            ))}
          </div>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <section className={cn(RISK_PROFILE_CARD_CLASS, "p-4 sm:p-5")}>
          <Skeleton className="mx-auto h-5 w-32" />
          <Skeleton className={cn("mx-auto mt-4 h-28 w-full max-w-[11rem]", RISK_PROFILE_HERO_RADIUS_CLASS)} />
          <div className="mt-4 flex justify-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </section>

        <section className={cn(RISK_PROFILE_CARD_CLASS, "p-4 sm:p-5")}>
          <Skeleton className="h-5 w-28" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-start gap-3">
                <Skeleton className="size-9 shrink-0 rounded-[var(--radius-control)]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
