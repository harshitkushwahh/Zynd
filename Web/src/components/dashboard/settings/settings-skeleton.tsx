import { Skeleton } from "@/components/ui/skeleton";

import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import { SettingsProfileDetailsTable } from "@/components/dashboard/settings/settings-profile-details-table";

function PanelBodySkeleton({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function ProfileDetailsRowSkeleton({ lines = 1 }: { lines?: number }) {
  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[minmax(10rem,12rem)_minmax(0,1fr)] sm:items-start sm:gap-x-5 sm:py-3.5">
      <Skeleton className="h-4 w-28" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full max-w-[15rem]" />
        {lines > 1 ? <Skeleton className="h-4 w-4/5" /> : null}
      </div>
    </div>
  );
}

export function PersonalDetailsProfileSkeletonRows({ count = 18 }: { count?: number }) {
  return (
    <SettingsProfileDetailsTable>
      {Array.from({ length: count }).map((_, index) => (
        <ProfileDetailsRowSkeleton key={index} lines={index >= 16 ? 2 : 1} />
      ))}
    </SettingsProfileDetailsTable>
  );
}

/** @deprecated Use PersonalDetailsProfileSkeletonRows */
export function PersonalDetailsProfileSkeletonTable() {
  return <PersonalDetailsProfileSkeletonRows />;
}

/** @deprecated Use PersonalDetailsProfileSkeletonRows */
export function PersonalDetailsIdentitySkeletonCards() {
  return <PersonalDetailsProfileSkeletonRows count={9} />;
}

/** @deprecated Use PersonalDetailsProfileSkeletonRows */
export function PersonalDetailsAddressSkeletonCards() {
  return <PersonalDetailsProfileSkeletonRows count={2} />;
}

export function PersonalDetailsSkeleton() {
  return (
    <PanelBodySkeleton>
      <PersonalDetailsProfileSkeletonRows />
    </PanelBodySkeleton>
  );
}

export function SettingsPanelHeaderSkeleton() {
  return (
    <div className="flex items-start gap-2.5 border-b border-border pb-4">
      <Skeleton className="size-8 shrink-0 rounded-[var(--radius-control)]" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
    </div>
  );
}

export function SettingsSidebarSkeleton() {
  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card md:h-full md:max-h-full md:w-72 md:min-h-0">
      <div className="border-b border-border px-5 py-6 text-center">
        <Skeleton className="mx-auto size-[4.5rem] rounded-full" />
        <Skeleton className="mx-auto mt-3.5 h-5 w-32" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="mb-1.5 h-11 w-full rounded-[var(--radius-control)] last:mb-0" />
        ))}
      </div>
    </aside>
  );
}

export function MfaPanelSkeleton() {
  return (
    <PanelBodySkeleton>
      <Skeleton className="h-[7.5rem] w-full rounded-[var(--radius-card)]" />
    </PanelBodySkeleton>
  );
}

export function SecurityFeatureCardSkeleton() {
  return <Skeleton className="h-[7.5rem] w-full rounded-[var(--radius-card)]" />;
}

export function BankAccountsPanelSkeleton() {
  return (
    <PanelBodySkeleton>
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-[var(--radius-card)]" />
        ))}
      </div>
    </PanelBodySkeleton>
  );
}

export function NotificationsPanelSkeleton() {
  return (
    <PanelBodySkeleton>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
        <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:grid-cols-[1fr_6rem_6rem] sm:px-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-10 justify-self-center" />
          <Skeleton className="h-3 w-12 justify-self-center" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 sm:grid-cols-[1fr_6rem_6rem] sm:px-5"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full max-w-sm" />
            </div>
            <Skeleton className="size-5 justify-self-center rounded-full" />
            <Skeleton className="size-5 justify-self-center rounded-full" />
          </div>
        ))}
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
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden md:flex-row md:items-stretch">
        <SettingsSidebarSkeleton />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <SettingsContentCard header={<SettingsPanelHeaderSkeleton />}>
            <PersonalDetailsSkeleton />
          </SettingsContentCard>
        </div>
      </div>
    </div>
  );
}
