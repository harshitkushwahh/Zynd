"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function NotificationListSkeleton() {
  return (
    <ul className="divide-y divide-border/70">
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="flex gap-3 px-3 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-2.5 w-12" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}
