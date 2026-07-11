import { Skeleton } from "@/components/ui/skeleton";

import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";

function PanelBodySkeleton({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function SettingsPanelHeaderSkeleton() {
  return (
    <div className="flex items-start gap-4 border-b border-border pb-6">
      <Skeleton className="size-12 shrink-0 rounded-[var(--radius-card)]" />
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
    </div>
  );
}

export function SettingsSidebarSkeleton() {
  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card md:h-full md:w-72">
      <div className="border-b border-border px-5 py-6 text-center">
        <Skeleton className="mx-auto size-[4.5rem] rounded-full" />
        <Skeleton className="mx-auto mt-3.5 h-5 w-32" />
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-[var(--radius-control)]" />
        ))}
      </div>
    </aside>
  );
}

export function PersonalDetailsSkeleton() {
  return (
    <PanelBodySkeleton>
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-40" />
          </div>
        ))}
      </div>
    </PanelBodySkeleton>
  );
}

export function MfaPanelSkeleton() {
  return (
    <PanelBodySkeleton>
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-44 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
      </div>
    </PanelBodySkeleton>
  );
}

export function DevicesPanelSkeleton() {
  return (
    <PanelBodySkeleton>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border px-4 py-3.5"
          >
            <Skeleton className="size-10 shrink-0 rounded-[var(--radius-control)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-8 w-20 rounded-[var(--radius-control)]" />
          </div>
        ))}
        <Skeleton className="h-9 w-52 rounded-[var(--radius-control)]" />
      </div>
    </PanelBodySkeleton>
  );
}

export function FormPanelSkeleton() {
  return (
    <PanelBodySkeleton>
      <div className="max-w-lg space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-32 rounded-[var(--radius-control)]" />
      </div>
    </PanelBodySkeleton>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="mb-6 flex shrink-0 items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden md:flex-row">
        <SettingsSidebarSkeleton />
        <SettingsContentCard header={<SettingsPanelHeaderSkeleton />}>
          <PersonalDetailsSkeleton />
        </SettingsContentCard>
      </div>
    </div>
  );
}
