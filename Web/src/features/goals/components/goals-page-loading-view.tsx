import type { ReactNode } from "react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalsListPageSkeleton } from "@/features/goals/components/goals-list-page-skeleton";
import { GoalsPageSkeleton } from "@/features/goals/components/goals-page-skeleton";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { GOALS_LIST_HREF } from "@/features/goals/lib/goal-navigation";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const goalsRoute = DASHBOARD_ROUTES.find((route) => route.id === "goals")!;
const GoalsIcon = goalsRoute.icon;

type GoalsListPageHeaderProps = {
  title: string;
  description: string;
  loading?: boolean;
};

export function GoalsListPageHeader({ title, description, loading = false }: GoalsListPageHeaderProps) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
        <GoalsIcon className="size-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-7 w-48 max-w-full" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
        ) : (
          <>
            <PageTitle>{title}</PageTitle>
            <p className="mt-2 max-w-2xl text-compact text-muted-foreground">{description}</p>
          </>
        )}
      </div>
    </div>
  );
}

export function GoalsPageLoadingView() {
  return (
    <div className="animate-in fade-in space-y-6 duration-200">
      <DashboardBreadcrumb items={[{ label: copy.goals.title }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
            <GoalsIcon className="size-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 space-y-2" aria-hidden="true">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-[var(--radius-control)]" />
        </div>
      </div>

      <GoalsPageSkeleton />
    </div>
  );
}

type GoalsListPageLoadingViewProps = {
  variant: "personal" | "family";
};

export function GoalsListPageLoadingView({ variant }: GoalsListPageLoadingViewProps) {
  const title =
    variant === "personal" ? copy.goals.personalGoalsListTitle : copy.goals.familyGoalsListTitle;
  const description =
    variant === "personal"
      ? copy.goals.personalGoalsListDescription
      : copy.goals.familyGoalsListDescription;

  return (
    <div className="animate-in fade-in space-y-6 duration-200">
      <DashboardBreadcrumb
        items={[
          { label: copy.goals.title, href: GOALS_LIST_HREF },
          { label: title },
        ]}
      />

      <GoalsListPageHeader title={title} description={description} loading />

      <GoalsListPageSkeleton variant={variant} />
    </div>
  );
}

export function GoalDetailPageLoadingView() {
  return (
    <div className="animate-in fade-in space-y-6 duration-200">
      <DashboardBreadcrumb
        items={[
          { label: copy.goals.title, href: GOALS_LIST_HREF },
          { label: copy.goals.detailTitle },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="size-11 shrink-0 rounded-[var(--radius-control)]" />
          <div className="min-w-0 space-y-2" aria-hidden="true">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
          <Skeleton className="h-6 w-10 rounded-full" />
          <Skeleton className="size-8 rounded-[var(--radius-control)]" />
          <Skeleton className="size-8 rounded-[var(--radius-control)]" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Skeleton className="h-64 rounded-[var(--radius-card)]" />
          <Skeleton className="h-40 rounded-[var(--radius-card)]" />
        </div>
        <Skeleton className="h-[22rem] rounded-[var(--radius-card)] xl:col-span-2" />
      </div>
    </div>
  );
}

export function GoalsContentFade({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("animate-in fade-in duration-200", className)}>{children}</div>;
}
