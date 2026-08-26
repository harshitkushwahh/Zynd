"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, Check, Clock, type LucideIcon } from "lucide-react";

import { ProfilePopoverDetailLines } from "@/features/dashboard/overview/components/profile-popover-detail-lines";
import { ProfileProgressRing } from "@/features/dashboard/overview/components/overview-profile-status-badge";
import type { OverviewKycProfileProgress } from "@/features/dashboard/overview/lib/overview-profile-kyc-state";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ProfileKycStatusPopoverCardProps = {
  progress: OverviewKycProfileProgress;
  stepIcon: LucideIcon;
  blocked?: boolean;
  activatable?: boolean;
  onActivate?: () => void;
  className?: string;
};

function PopoverShell({
  activatable,
  onActivate,
  ariaLabel,
  className,
  children,
}: {
  activatable: boolean;
  onActivate?: () => void;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  if (!activatable || !onActivate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        "group/popover relative block w-full rounded-[inherit] text-left outline-none transition-colors duration-200 hover:bg-muted/35 focus-visible:bg-muted/35",
        className,
      )}
      aria-label={ariaLabel}
    >
      <ArrowUpRight
        className="absolute right-3 top-3 size-3.5 text-muted-foreground transition-colors duration-200 group-hover/popover:text-primary"
        aria-hidden
      />
      {children}
    </button>
  );
}

export function ProfileKycStatusPopoverCard({
  progress,
  stepIcon,
  blocked = false,
  activatable = false,
  onActivate,
  className,
}: ProfileKycStatusPopoverCardProps) {
  const overview = copy.dashboard.overview;

  if (blocked) {
    return (
      <div className={cn("p-3 text-center", className)}>
        <p className="text-compact font-semibold text-foreground">
          {overview.profileKycTooltipBlockedTitle}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {overview.profileKycTooltipBlocked}
        </p>
      </div>
    );
  }

  const {
    tooltipVariant,
    tooltipTitle,
    tooltipDetail,
    progressFraction,
    tone,
    stepTitle,
    progressPercent,
  } = progress;

  const openAria =
    tooltipVariant === "not_started"
      ? overview.profileKycPopoverOpenNotStartedAria
      : overview.profileKycPopoverOpenInProgressAria;

  if (tooltipVariant === "verified") {
    return (
      <div className={cn("flex flex-col items-center px-3.5 pb-3.5 pt-3 text-center", className)}>
        <div className="relative flex size-10 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--success)_28%,white)_0%,color-mix(in_srgb,var(--success)_10%,transparent)_100%)] ring-1 ring-success/20"
            aria-hidden
          />
          <span className="relative flex size-7 items-center justify-center rounded-full bg-success text-success-foreground shadow-[0_2px_8px_color-mix(in_srgb,var(--success)_35%,transparent)] ring-2 ring-success/15 ring-offset-2 ring-offset-popover">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          </span>
        </div>

        <p className="mt-2 text-compact font-semibold text-foreground">{tooltipTitle}</p>
        <ProfilePopoverDetailLines
          lines={[overview.profileKycTooltipCompleteLine1]}
        />
      </div>
    );
  }

  if (tooltipVariant === "submitted") {
    return (
      <div className={cn("flex flex-col items-center px-3.5 pb-3.5 pt-3 text-center", className)}>
        <div className="relative flex size-10 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--warning)_24%,white)_0%,color-mix(in_srgb,var(--warning)_8%,transparent)_100%)] ring-1 ring-warning/20"
            aria-hidden
          />
          <span className="relative flex size-7 items-center justify-center rounded-full bg-warning text-warning-foreground shadow-[0_2px_8px_color-mix(in_srgb,var(--warning)_30%,transparent)] ring-2 ring-warning/15 ring-offset-2 ring-offset-popover">
            <Clock className="size-3.5" strokeWidth={2.5} aria-hidden />
          </span>
        </div>
        <p className="mt-2 text-compact font-semibold text-foreground">{tooltipTitle}</p>
        <p className="mt-1.5 max-w-[12.5rem] text-[11px] leading-relaxed text-muted-foreground">
          {tooltipDetail}
        </p>
      </div>
    );
  }

  return (
    <PopoverShell
      activatable={activatable}
      onActivate={onActivate}
      ariaLabel={openAria}
      className={className}
    >
      <div className="flex flex-col items-center px-3.5 pb-3.5 pt-3 text-center">
        <ProfileProgressRing
          className="size-9"
          progressFraction={progressFraction}
          tone={tone}
          icon={stepIcon}
          complete={false}
          submitted={false}
        />
        <p className="mt-2 max-w-full pr-4 text-compact font-semibold text-foreground">{tooltipTitle}</p>
        <p className="mt-1.5 max-w-[12.5rem] text-[11px] leading-relaxed text-muted-foreground">
          {tooltipDetail}
        </p>
        {tooltipVariant === "in_progress" ? (
          <p className="mt-1.5 text-[10px] font-medium text-muted-foreground">
            {stepTitle} · {progressPercent}%
          </p>
        ) : null}
      </div>
    </PopoverShell>
  );
}
