import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ShieldCheck, UserRound } from "lucide-react";

import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import {
  SETTINGS_PROFILE_FIELD_SKELETON_CLASS,
} from "@/components/dashboard/settings/settings-profile-field-card";
import { SettingsProfileSectionCard } from "@/components/dashboard/settings/settings-profile-section-card";

function PanelBodySkeleton({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function ProfileFieldSkeleton({ lines = 1 }: { lines?: number }) {
  return (
    <div className={SETTINGS_PROFILE_FIELD_SKELETON_CLASS}>
      <Skeleton className="h-3 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full max-w-[12rem]" />
        {lines > 1 ? <Skeleton className="h-4 w-4/5" /> : null}
      </div>
    </div>
  );
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
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card md:h-full md:max-h-full md:w-72">
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

/** Skeleton cards for identity fields — use inside SettingsProfileSectionCard. */
export function PersonalDetailsIdentitySkeletonCards() {
  return (
    <>
      {Array.from({ length: 9 }).map((_, index) => (
        <ProfileFieldSkeleton key={index} />
      ))}
    </>
  );
}

/** Skeleton cards for address fields — use inside SettingsProfileSectionCard. */
export function PersonalDetailsAddressSkeletonCards() {
  return (
    <>
      <div className="sm:col-span-2 xl:col-span-3">
        <ProfileFieldSkeleton lines={2} />
      </div>
      <div className="sm:col-span-2 xl:col-span-3">
        <ProfileFieldSkeleton lines={2} />
      </div>
    </>
  );
}

export function PersonalDetailsSkeleton() {
  return (
    <PanelBodySkeleton>
      <div className="space-y-5">
        <SettingsProfileSectionCard title="Account" icon={UserRound} tone="primary">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProfileFieldSkeleton key={`account-${index}`} />
          ))}
        </SettingsProfileSectionCard>
        <SettingsProfileSectionCard title="Identity" icon={ShieldCheck} tone="success">
          <PersonalDetailsIdentitySkeletonCards />
        </SettingsProfileSectionCard>
        <SettingsProfileSectionCard title="Address" icon={MapPin} tone="info">
          <PersonalDetailsAddressSkeletonCards />
        </SettingsProfileSectionCard>
      </div>
    </PanelBodySkeleton>
  );
}

export function MfaPanelSkeleton() {
  return (
    <PanelBodySkeleton>
      <Skeleton className="h-[7.5rem] w-full rounded-[var(--radius-card)]" />
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
