"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_PROGRESS_CARD_WIDTH_CLASS } from "@/features/goals/components/goal-progress-card";
import { ZYND_CARD_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

function CardShell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        ZYND_CARD_RADIUS_CLASS,
        "border border-border bg-card p-3.5 shadow-zynd-low",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function OverviewPageSkeleton() {
  return (
    <div className="w-full min-w-0" aria-busy="true" aria-live="polite">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,1.15fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-[minmax(9rem,10.5rem)_minmax(0,1fr)] gap-3 sm:gap-4">
            <CardShell className="aspect-square min-h-[9.5rem]">
              <div className="flex h-full flex-col items-center justify-between">
                <div className="flex w-full items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="size-3.5" />
                </div>
                <Skeleton className="h-14 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
            </CardShell>

            <CardShell className="min-h-[9.5rem]">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-7 w-24 rounded-[var(--radius-control)]" />
              </div>
              <div className="mt-4 flex gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex flex-col items-center gap-1.5">
                    <Skeleton className="size-12 rounded-full" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                ))}
              </div>
            </CardShell>
          </div>

          <CardShell>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-7 w-20 rounded-[var(--radius-control)]" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex -space-x-2.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="size-11 rounded-full ring-2 ring-card" />
                ))}
              </div>
              <div className="space-y-1.5 text-right">
                <Skeleton className="ml-auto h-6 w-24" />
                <div className="flex justify-end gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </CardShell>

          <CardShell className="p-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-7 w-20 rounded-[var(--radius-control)]" />
            </div>
            <div className="max-h-[8.75rem] space-y-0 overflow-hidden px-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 border-b border-border/60 py-3 last:border-b-0"
                >
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </CardShell>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <CardShell>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="size-7 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-7 w-28 rounded-[var(--radius-control)]" />
            </div>
            <Skeleton className="mt-4 h-[5.5rem] w-full rounded-[var(--radius-control)]" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-[4.25rem] rounded-[var(--radius-control)]" />
              ))}
            </div>
          </CardShell>

          <CardShell className="p-0">
            <div className="flex items-center justify-between px-4 pt-3.5">
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-7 w-20 rounded-[var(--radius-control)]" />
            </div>
            <div className="flex gap-3 overflow-hidden px-4 py-3.5">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className={cn(
                    GOAL_PROGRESS_CARD_WIDTH_CLASS,
                    "h-[5.5rem] shrink-0 rounded-[var(--radius-card)]",
                  )}
                />
              ))}
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}
