"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { FieldMessage } from "@/components/ui/ui-message";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import { OVERVIEW_SIPS_LOCKED_PREVIEW } from "@/features/dashboard/overview/lib/overview-locked-preview-data";
import { type MfSipPlan } from "@/features/invest/api/invest-api";
import { useMfSipPlansQuery } from "@/features/invest/hooks/use-mf-sip-plans-query";
import { mfSipPlanStatusVariant } from "@/features/invest/components/mf-sip-plan-status-badge";
import { formatInr, resolveInvestAssetUrl } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 4;
const MY_SIPS_HREF = "/dashboard/my-sips";

function isActiveSip(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "active" || normalized === "activated" || normalized === "created";
}

function amcInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function SipAmcCircle({ plan }: { plan: MfSipPlan }) {
  const amcName = plan.amc_name ?? copy.mutualFunds.unknownAmc;
  const logoUrl = resolveInvestAssetUrl(plan.amc_logo_url);
  const statusVariant = mfSipPlanStatusVariant(plan.status);

  return (
    <div className="relative z-10 shrink-0 hover:z-30 focus-within:z-30">
      <div
        className={cn(
          "group flex h-11 max-w-11 items-center rounded-full",
          "border border-border/80 bg-card shadow-zynd-low outline-none",
          "transition-[max-width,border-color,box-shadow] duration-200 ease-out",
          "hover:max-w-48 hover:border-primary/30 hover:shadow-zynd-mid",
          "focus-within:max-w-48 focus-within:border-primary/30 focus-within:shadow-zynd-mid",
        )}
      >
        <div className="flex size-11 shrink-0 items-center justify-center">
          <div className="size-9 overflow-hidden rounded-full bg-muted/50 ring-1 ring-border">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                {amcInitials(amcName)}
              </span>
            )}
          </div>
        </div>

        <span
          className={cn(
            "flex min-w-0 items-center overflow-hidden whitespace-nowrap pr-2",
            "max-w-0 opacity-0 transition-[max-width,opacity] duration-200 ease-out",
            "group-hover:max-w-36 group-hover:opacity-100",
            "group-focus-within:max-w-36 group-focus-within:opacity-100",
          )}
        >
          <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/40 px-2.5 text-[10px] font-semibold tabular-nums text-foreground">
            {formatInr(plan.amount_inr)}
          </span>
        </span>
      </div>

      <StatusBadge
        variant={statusVariant}
        className="pointer-events-none absolute -right-1 -bottom-1 z-20 size-5 justify-center rounded-full px-0 shadow-zynd-low ring-2 ring-card [&_svg]:size-2.5!"
      >
        <span className="sr-only">{plan.status}</span>
      </StatusBadge>
    </div>
  );
}

function LockedSipPreviewCircle({
  amcName,
  amountInr,
}: {
  amcName: string;
  amountInr: number;
}) {
  return (
    <div className="relative z-10 shrink-0">
      <div className="flex h-11 w-11 items-center rounded-full border border-border/80 bg-card shadow-zynd-low">
        <div className="flex size-11 shrink-0 items-center justify-center">
          <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-muted/50 ring-1 ring-border">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {amcInitials(amcName)}
            </span>
          </div>
        </div>
      </div>
      <StatusBadge
        variant="success"
        className="pointer-events-none absolute -right-1 -bottom-1 z-20 size-5 justify-center rounded-full px-0 shadow-zynd-low ring-2 ring-card [&_svg]:size-2.5!"
      >
        <span className="sr-only">{formatInr(amountInr)}</span>
      </StatusBadge>
    </div>
  );
}

function LockedSipsPreviewContent() {
  const overview = copy.dashboard.overview;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center pl-0.5">
        <div className="flex items-center -space-x-2.5">
          {OVERVIEW_SIPS_LOCKED_PREVIEW.map((plan) => (
            <LockedSipPreviewCircle key={plan.id} amcName={plan.amcName} amountInr={plan.amountInr} />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-h4 font-semibold tabular-nums tracking-tight text-foreground">
          {formatInr(10_500)}
          <span className="ml-1 text-caption font-medium text-muted-foreground">/mo</span>
        </p>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <StatusBadge variant="success" showIcon={false} className="rounded-full text-[10px] tabular-nums">
            {overview.sipsActiveCount.replace("{count}", "3")}
          </StatusBadge>
          <StatusBadge variant="info" showIcon={false} className="rounded-full text-[10px] tabular-nums">
            {overview.sipsPlansCount.replace("{count}", "3")}
          </StatusBadge>
        </div>
      </div>
    </div>
  );
}

type OverviewSipsCardProps = {
  className?: string;
};

export function OverviewSipsCard({ className }: OverviewSipsCardProps) {
  const overview = copy.dashboard.overview;
  const { plans, showSkeleton, errorMessage } = useMfSipPlansQuery();
  const loading = showSkeleton;
  const error = errorMessage;

  const previewPlans = useMemo(() => {
    const active = plans.filter((plan) => isActiveSip(plan.status));
    const rest = plans.filter((plan) => !isActiveSip(plan.status));
    return [...active, ...rest].slice(0, PREVIEW_LIMIT);
  }, [plans]);

  const activeCount = useMemo(
    () => plans.filter((plan) => isActiveSip(plan.status)).length,
    [plans],
  );

  const monthlyTotal = useMemo(
    () =>
      plans
        .filter((plan) => isActiveSip(plan.status))
        .reduce((sum, plan) => sum + (plan.amount_inr || 0), 0),
    [plans],
  );

  return (
    <Link
      href={MY_SIPS_HREF}
      className={cn(
        "group flex min-h-[9.5rem] min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-3.5 shadow-zynd-low",
        "transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/25 hover:shadow-zynd-mid",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-caption font-semibold text-foreground">{overview.sipsTitle}</p>
        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-center">
        {loading ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex -space-x-2.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="size-11 rounded-full ring-2 ring-card" />
              ))}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Skeleton className="h-5 w-20" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ) : null}

        {error ? <FieldMessage variant="error" message={error} /> : null}

        {!loading && !error && plans.length === 0 ? (
          <div className="relative min-h-[5.5rem] flex-1">
            <div className="blur-[5px]">
              <LockedSipsPreviewContent />
            </div>
            <OverviewLockedCardBackdrop />
            <OverviewLockedCardOverlay
              compact
              title={overview.sipsTitle}
              subtitle={overview.sipsEmpty}
            />
          </div>
        ) : null}

        {!loading && !error && plans.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center pl-0.5">
              <div className="flex items-center -space-x-2.5">
                {previewPlans.map((plan) => (
                  <SipAmcCircle key={plan.plan_id} plan={plan} />
                ))}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <p className="text-h4 font-semibold tabular-nums tracking-tight text-foreground">
                {formatInr(monthlyTotal)}
                <span className="ml-1 text-caption font-medium text-muted-foreground">/mo</span>
              </p>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <StatusBadge
                  variant={activeCount > 0 ? "success" : "neutral"}
                  showIcon={false}
                  className="rounded-full text-[10px] tabular-nums"
                >
                  {overview.sipsActiveCount.replace("{count}", String(activeCount))}
                </StatusBadge>
                <StatusBadge
                  variant="info"
                  showIcon={false}
                  className="rounded-full text-[10px] tabular-nums"
                >
                  {overview.sipsPlansCount.replace("{count}", String(plans.length))}
                </StatusBadge>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function OverviewSipsCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[9.5rem] min-w-0 flex-1 flex-col rounded-[1.75rem] border border-border/60 bg-card p-3.5 shadow-zynd-low",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="size-3.5" />
      </div>
      <div className="mt-3 flex flex-1 items-center justify-between gap-3">
        <div className="flex -space-x-2.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="size-11 rounded-full ring-2 ring-card" />
          ))}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Skeleton className="h-5 w-20" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
