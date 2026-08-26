"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FAMILY_GROUP_CARD_RADIUS_CLASS, FAMILY_GROUP_DASHBOARD_PANEL_CLASS, FAMILY_GROUP_HERO_GRADIENT_CLASS, FAMILY_GROUP_HERO_OVERLAY_CLASS, FAMILY_GROUP_HERO_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { cn } from "@/lib/utils";

export function FamilyGroupDashboardContentSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <section
          className={cn(
            "relative isolate min-h-[24rem] min-w-0 flex-1 overflow-hidden p-4 shadow-zynd-mid ring-1 ring-inset ring-primary-foreground/10 sm:min-h-[26rem] sm:p-5 lg:p-6",
            FAMILY_GROUP_HERO_RADIUS_CLASS,
            FAMILY_GROUP_HERO_GRADIENT_CLASS,
          )}
        >
          <div className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", FAMILY_GROUP_HERO_OVERLAY_CLASS)} />
          <div className="pointer-events-none absolute left-0 top-0 size-40 -translate-x-1/4 -translate-y-1/4 rounded-full bg-[color-mix(in_srgb,var(--zynd-navy)_22%,var(--zynd-blue-dark))] opacity-[0.24] blur-3xl" />
          <div className="pointer-events-none absolute left-[8%] top-[38%] size-44 rounded-full bg-[color-mix(in_srgb,var(--zynd-blue)_28%,white)] opacity-[0.22] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-[18%] size-40 rounded-full bg-[color-mix(in_srgb,var(--zynd-emerald)_20%,transparent)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[18%] right-0 size-40 translate-x-1/4 rounded-full bg-[color-mix(in_srgb,var(--zynd-blue-dark)_55%,var(--zynd-blue))] opacity-[0.18] blur-3xl" />
          <div className="relative z-10 grid min-h-[22rem] grid-cols-1 gap-4 md:grid-cols-2 md:items-center sm:min-h-[24rem]">
            <div className="flex items-center justify-center">
              <Skeleton className="size-28 rounded-full bg-skeleton-on-brand" />
            </div>
            <div className={cn("space-y-3 border border-primary-foreground/12 bg-[color-mix(in_srgb,var(--zynd-navy)_16%,transparent)] p-4 backdrop-blur-[5px]", FAMILY_GROUP_CARD_RADIUS_CLASS)}>
              <Skeleton className="h-4 w-24 bg-skeleton-on-brand" />
              <div className="flex items-start gap-3">
                <Skeleton className="size-14 shrink-0 rounded-full bg-skeleton-on-brand" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-32 bg-skeleton-on-brand" />
                  <Skeleton className="h-5 w-20 rounded-full bg-skeleton-on-brand" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-14 w-full rounded-[var(--radius-control)] bg-skeleton-on-brand" />
                <Skeleton className="h-14 w-full rounded-[var(--radius-control)] bg-skeleton-on-brand" />
              </div>
              <Skeleton className="h-10 w-full rounded-[var(--radius-control)] bg-skeleton-on-brand" />
            </div>
          </div>
        </section>

        <section
          className={cn(
            FAMILY_GROUP_DASHBOARD_PANEL_CLASS,
            "min-h-[24rem] w-full p-3 sm:min-h-[26rem] sm:p-4 xl:w-[20rem] xl:shrink-0",
          )}
        >
          <Skeleton className="h-4 w-28" />
          <div className="mt-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-[5.5rem] w-full rounded-[var(--radius-control)]" />
              <Skeleton className="h-[5.5rem] w-full rounded-[var(--radius-control)]" />
            </div>
            <Skeleton className="h-[4.75rem] w-full rounded-[var(--radius-control)]" />
            <Skeleton className="h-px w-full" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-[5.5rem] w-full rounded-[var(--radius-control)]" />
              <Skeleton className="h-[5.5rem] w-full rounded-[var(--radius-control)]" />
            </div>
          </div>
        </section>
      </div>

      <section className={cn(FAMILY_GROUP_DASHBOARD_PANEL_CLASS, "flex items-center gap-3 p-3 sm:p-4")}>
        <Skeleton className="h-5 w-10 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="size-10 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Skeleton className="h-8 w-8 rounded-[var(--radius-control)] sm:w-28" />
          <Skeleton className="h-8 w-8 rounded-[var(--radius-control)] sm:w-20" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className={cn(FAMILY_GROUP_DASHBOARD_PANEL_CLASS, "min-h-[18rem] p-3 sm:p-4")}>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mx-auto mt-6 size-36 rounded-full" />
          <div className="mx-auto mt-4 flex max-w-xs justify-center gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </section>

        <section className={cn(FAMILY_GROUP_DASHBOARD_PANEL_CLASS, "min-h-[18rem] p-3 sm:p-4")}>
          <Skeleton className="h-4 w-32" />
          <div className="mt-2 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className={cn("h-[4.5rem] w-full", FAMILY_GROUP_CARD_RADIUS_CLASS)} />
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <section className={cn(FAMILY_GROUP_DASHBOARD_PANEL_CLASS, "min-h-[14rem] p-3 sm:p-4")}>
          <Skeleton className="h-4 w-36" />
          <div className="mt-2 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className={cn("h-[4.5rem] w-full", FAMILY_GROUP_CARD_RADIUS_CLASS)} />
            ))}
          </div>
        </section>

        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="col-span-1 min-h-[180px] rounded-card" />
            <Skeleton className="col-span-1 min-h-[180px] rounded-card" />
            <Skeleton className="col-span-2 min-h-[128px] rounded-card" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FamilyGroupDashboardSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="flex gap-2 overflow-hidden pb-1">
        <Skeleton className="h-10 w-[10rem] shrink-0 rounded-full" />
        <Skeleton className="h-10 w-[9rem] shrink-0 rounded-full" />
      </div>
      <FamilyGroupDashboardContentSkeleton />
    </div>
  );
}
