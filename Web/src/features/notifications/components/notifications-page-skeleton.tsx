import { NotificationListSkeleton } from "@/components/dashboard/notifications/notification-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { NOTIFICATION_SURFACE_RADIUS_CLASS } from "@/features/notifications/lib/notification-filter-tabs";
import { cn } from "@/lib/utils";

function NotificationsBreadcrumbSkeleton() {
  return (
    <div className="mb-6 flex shrink-0 items-center gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="size-3.5 rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export function NotificationsPageSkeleton() {
  return (
    <>
      <NotificationsBreadcrumbSkeleton />

      <div
        className={cn(
          "overflow-hidden border border-border bg-card shadow-zynd-low",
          NOTIFICATION_SURFACE_RADIUS_CLASS,
        )}
      >
        <div className="border-b border-border bg-muted/20 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="size-9 shrink-0 rounded-[var(--radius-control)]" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3.5 w-48" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-8 w-24 rounded-[var(--radius-control)]" />
              <Skeleton className="h-8 w-28 rounded-[var(--radius-control)]" />
            </div>
          </div>

          <Skeleton className="mt-4 h-9 w-full max-w-xs rounded-[var(--radius-full)]" />
        </div>

        <div className="min-h-[16rem]">
          <NotificationListSkeleton />
        </div>
      </div>
    </>
  );
}
