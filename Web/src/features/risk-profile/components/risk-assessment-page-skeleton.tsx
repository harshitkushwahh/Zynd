"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  RISK_PROFILE_CARD_CLASS,
  RISK_PROFILE_DEFAULT_QUESTION_COUNT,
  RISK_PROFILE_HERO_GRADIENT_CLASS,
  RISK_PROFILE_HERO_RADIUS_CLASS,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { cn } from "@/lib/utils";

const SKELETON_STEP_COUNT = RISK_PROFILE_DEFAULT_QUESTION_COUNT;
const SKELETON_OPTION_COUNT = 4;

export function RiskAssessmentPageSkeleton() {
  return (
    <>
      <div className={cn(RISK_PROFILE_CARD_CLASS, "relative overflow-hidden p-4")}>
        <div className="relative z-10 space-y-3 sm:max-w-[calc(100%-8rem)]">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-7 w-full max-w-xs sm:max-w-sm" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>

        <div className="pointer-events-none absolute inset-y-4 right-4 z-0 hidden w-24 sm:block sm:w-28 md:w-32">
          <Skeleton className="h-full w-full rounded-[var(--radius-card)] opacity-60" />
        </div>

        <div className="relative z-10 mt-4 flex items-center gap-2 overflow-hidden">
          {Array.from({ length: SKELETON_STEP_COUNT }, (_, index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              {index < SKELETON_STEP_COUNT - 1 ? <Skeleton className="h-0.5 w-5 shrink-0 rounded-full" /> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className={cn(RISK_PROFILE_CARD_CLASS, "flex h-full min-h-[22rem] flex-col p-4")}>
          <div className="flex-1 space-y-4">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-[92%]" />
            </div>
            <div className="space-y-2 pt-1">
              {Array.from({ length: SKELETON_OPTION_COUNT }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-[var(--radius-control)]" />
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-16 rounded-[var(--radius-control)]" />
              <Skeleton className="h-9 w-24 rounded-[var(--radius-control)]" />
            </div>
            <Skeleton className="h-9 w-28 rounded-[var(--radius-control)]" />
          </div>
        </div>

        <aside
          className={cn(
            "relative flex h-full min-h-[22rem] w-full flex-col overflow-hidden border border-primary-foreground/10 p-4 shadow-zynd-mid",
            RISK_PROFILE_HERO_RADIUS_CLASS,
            RISK_PROFILE_HERO_GRADIENT_CLASS,
          )}
        >
          <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-15" aria-hidden />
          <div className="relative z-10 flex flex-1 flex-col">
            <Skeleton className="h-6 w-32 bg-skeleton-on-brand" />
            <Skeleton className="mx-auto my-4 h-28 w-full max-w-[11rem] rounded-[var(--radius-card)] bg-skeleton-on-brand" />
            <div className="mt-auto space-y-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-[var(--radius-control)] bg-skeleton-on-brand" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-skeleton-on-brand" />
                    <Skeleton className="h-3 w-full bg-skeleton-on-brand" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
