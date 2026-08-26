"use client";

import Link from "next/link";
import { Check, Clock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const BADGE_SIZE = 28;
const BADGE_RADIUS = 11;
const BADGE_CIRCUMFERENCE = 2 * Math.PI * BADGE_RADIUS;

type ProfileStatusTooltipProps = {
  title: string;
  detail: string;
};

export function ProfileStatusTooltipBody({ title, detail }: ProfileStatusTooltipProps) {
  return (
    <div className="space-y-1 text-left">
      <p className="font-semibold leading-snug">{title}</p>
      <p className="text-[11px] leading-relaxed text-background/85">{detail}</p>
    </div>
  );
}

type ProfileProgressRingProps = {
  progressFraction: number;
  tone: "success" | "warning" | "muted";
  icon: LucideIcon;
  complete?: boolean;
  submitted?: boolean;
  className?: string;
};

export function ProfileProgressRing({
  progressFraction,
  tone,
  icon: Icon,
  complete = false,
  submitted = false,
  className,
}: ProfileProgressRingProps) {
  const stroke =
    tone === "success"
      ? "var(--success)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--muted-foreground)";
  const trackOpacity = tone === "muted" ? 0.22 : 0.18;
  const dashOffset = BADGE_CIRCUMFERENCE * (1 - Math.min(Math.max(progressFraction, 0), 1));

  return (
    <div className={cn("relative size-7 shrink-0", className)}>
      <svg
        className="pointer-events-none absolute inset-0 size-full -rotate-90"
        viewBox={`0 0 ${BADGE_SIZE} ${BADGE_SIZE}`}
        aria-hidden
      >
        <circle
          cx={BADGE_SIZE / 2}
          cy={BADGE_SIZE / 2}
          r={BADGE_RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeOpacity={trackOpacity}
        />
        <circle
          cx={BADGE_SIZE / 2}
          cy={BADGE_SIZE / 2}
          r={BADGE_RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={BADGE_CIRCUMFERENCE}
          strokeDashoffset={complete || submitted ? 0 : dashOffset}
        />
      </svg>
      <div
        className={cn(
          "absolute inset-[2px] flex items-center justify-center rounded-full",
          complete
            ? "bg-success text-success-foreground"
            : submitted
              ? "bg-warning text-warning-foreground"
              : tone === "warning"
                ? "bg-white text-warning ring-1 ring-warning/20"
                : "bg-white text-muted-foreground ring-1 ring-border/80",
        )}
      >
        {complete ? (
          <Check className="size-3" strokeWidth={2.75} aria-hidden />
        ) : submitted ? (
          <Clock className="size-3" strokeWidth={2.5} aria-hidden />
        ) : (
          <Icon className="size-3" strokeWidth={2.25} aria-hidden />
        )}
      </div>
    </div>
  );
}

type ProfileStatusBadgeProps = {
  href?: string;
  onClick?: () => void;
  ariaLabel: string;
  tooltipTitle: string;
  tooltipDetail: string;
  tooltipContent?: ReactNode;
  ring: ProfileProgressRingProps;
  label?: ReactNode;
  filled?: boolean;
  complete?: boolean;
};

export function ProfileStatusBadge({
  href,
  onClick,
  ariaLabel,
  tooltipTitle,
  tooltipDetail,
  tooltipContent,
  ring,
  label,
  filled = false,
  complete = false,
}: ProfileStatusBadgeProps) {
  const inner = (
    <>
      {label ? (
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-[8px] font-bold uppercase tracking-wide",
            filled
              ? complete
                ? "bg-success text-white"
                : "bg-warning text-white"
              : complete
                ? "bg-white text-success ring-2 ring-success/25"
                : "bg-white text-warning ring-2 ring-warning/35",
          )}
        >
          {label}
        </span>
      ) : (
        <ProfileProgressRing {...ring} />
      )}
    </>
  );

  const triggerClass = cn(
    "inline-flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    (href || onClick) && "cursor-pointer transition-transform hover:scale-105 active:scale-95",
  );

  const triggerProps = {
    "aria-label": ariaLabel,
    className: triggerClass,
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          href ? (
            <Link href={href} {...triggerProps}>
              {inner}
            </Link>
          ) : onClick ? (
            <button type="button" onClick={onClick} {...triggerProps}>
              {inner}
            </button>
          ) : (
            <button type="button" {...triggerProps}>
              {inner}
            </button>
          )
        }
      />
      <TooltipContent side="top" align="center" sideOffset={8} className="max-w-[15rem] px-3 py-2">
        {tooltipContent ?? (
          <ProfileStatusTooltipBody title={tooltipTitle} detail={tooltipDetail} />
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export { BADGE_SIZE };
export type { ProfileProgressRingProps };
