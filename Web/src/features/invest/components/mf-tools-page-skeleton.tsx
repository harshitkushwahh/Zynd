import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MF_CALC_CARD_CLASS,
  MF_CALC_CARD_CONTENT_CLASS,
  MF_CALC_PANEL_CLASS,
} from "@/features/invest/lib/mf-calculator-ui";
import { MF_CARD_RADIUS_CLASS, MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { cn } from "@/lib/utils";

function MfToolsBreadcrumbSkeleton() {
  return (
    <div className="mb-6 flex shrink-0 items-center gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="size-3.5 rounded-full" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}

function MfToolsSidebarSkeleton() {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[21rem]">
      {Array.from({ length: 2 }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(MF_CARD_RADIUS_CLASS, "h-36 w-full border border-border/60")}
        />
      ))}
    </aside>
  );
}

function MfToolsPageHeaderSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-52 max-w-full" />
      <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-1.5 h-4 w-4/5 max-w-xl" />
    </div>
  );
}

function MfToolsShellSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfToolsBreadcrumbSkeleton />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <MfToolsPageHeaderSkeleton />
          {children}
        </div>
        <MfToolsSidebarSkeleton />
      </div>
    </div>
  );
}

function MfCalculatorPanelSkeleton() {
  return (
    <div className={MF_CALC_PANEL_CLASS}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      <div className="mt-1.5 flex justify-between">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

export function MfCalculatorInputsCardSkeleton({ panels = 2 }: { panels?: number }) {
  return (
    <Card className={cn("h-full", MF_CALC_CARD_CLASS)}>
      <CardContent className={MF_CALC_CARD_CONTENT_CLASS}>
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-10 w-full rounded-[var(--radius-control)]" />
        {Array.from({ length: panels }).map((_, index) => (
          <MfCalculatorPanelSkeleton key={index} />
        ))}
      </CardContent>
    </Card>
  );
}

export function MfSipCalculatorResultsSkeleton() {
  return (
    <Card className={cn("h-full", MF_CALC_CARD_CLASS)}>
      <CardContent className={cn("h-full", MF_CALC_CARD_CONTENT_CLASS)}>
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="rounded-[var(--radius-card)] border border-border/50 px-4 py-4">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-2 h-9 w-40" />
          <Skeleton className="mt-2 h-3.5 w-24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className={MF_CALC_PANEL_CLASS}>
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="mt-2 h-6 w-24" />
            </div>
          ))}
        </div>
        <div className={MF_CALC_PANEL_CLASS}>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-12" />
          </div>
          <Skeleton className="mt-3 h-2 w-full rounded-full" />
          <div className="mt-2.5 flex gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-[var(--radius-control)]" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MfSipCalculatorChartSkeleton() {
  return (
    <Card className={cn("w-full", MF_CALC_CARD_CLASS)}>
      <CardContent className={cn(MF_CALC_CARD_CONTENT_CLASS, "gap-4")}>
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-[320px] w-full rounded-[var(--radius-card)]" />
      </CardContent>
    </Card>
  );
}

export function MfSipCalculatorPageSkeleton() {
  return (
    <MfToolsShellSkeleton>
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <MfCalculatorInputsCardSkeleton panels={3} />
          <MfSipCalculatorResultsSkeleton />
        </div>
        <MfSipCalculatorChartSkeleton />
      </div>
    </MfToolsShellSkeleton>
  );
}

export function MfLumpsumCalculatorResultsSkeleton() {
  return (
    <Card className={cn("h-full", MF_CALC_CARD_CLASS)}>
      <CardContent className={cn("h-full", MF_CALC_CARD_CONTENT_CLASS)}>
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="flex border-b border-border/60">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="mx-2 mb-2 h-8 flex-1" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-3">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-48" />
            <div className={MF_CALC_PANEL_CLASS}>
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-3 h-2 w-full rounded-full" />
            </div>
          </div>
          <Skeleton className="mx-auto size-36 rounded-full" />
        </div>
        <Skeleton className="mt-auto h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export function MfLumpsumCalculatorPageSkeleton() {
  return (
    <MfToolsShellSkeleton>
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <MfCalculatorInputsCardSkeleton panels={1} />
          <MfLumpsumCalculatorResultsSkeleton />
        </div>
        <MfSipCalculatorChartSkeleton />
      </div>
    </MfToolsShellSkeleton>
  );
}

export function MfCompareResultsTableSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <div className={cn(MF_CALC_PANEL_CLASS, "overflow-hidden p-0")}>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex border-b border-border/60 bg-muted/30 px-4 py-4">
            <Skeleton className="h-10 w-[11rem] shrink-0" />
            {Array.from({ length: columns }).map((_, index) => (
              <div key={index} className="min-w-[12rem] flex-1 px-4">
                <div className="flex items-start gap-2.5">
                  <Skeleton className="size-8 shrink-0 rounded-[var(--radius-control)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="flex border-b border-border/40 px-4 py-3.5 last:border-b-0"
            >
              <Skeleton className="h-4 w-24 shrink-0" />
              {Array.from({ length: columns }).map((__, colIndex) => (
                <Skeleton key={colIndex} className="mx-4 h-4 min-w-[8rem] flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MfCompareFundsSelectionSkeleton() {
  return (
    <Card className={MF_CALC_CARD_CLASS}>
      <CardContent className={MF_CALC_CARD_CONTENT_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-14 w-28 rounded-[var(--radius-control)]" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={cn(MF_CALC_PANEL_CLASS, "space-y-3")}>
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-10 w-full rounded-[var(--radius-control)]" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MfCompareFundsResultsSkeleton({ columns = 2 }: { columns?: number }) {
  return (
    <Card className={MF_CALC_CARD_CLASS}>
      <CardContent className={MF_CALC_CARD_CONTENT_CLASS}>
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-36" />
        </div>
        <MfCompareResultsTableSkeleton columns={columns} />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export function MfCompareFundsPageSkeleton() {
  return (
    <MfToolsShellSkeleton>
      <div className="space-y-6">
        <MfCompareFundsSelectionSkeleton />
        <MfCompareFundsResultsSkeleton columns={2} />
      </div>
    </MfToolsShellSkeleton>
  );
}
