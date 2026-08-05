"use client";

import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

type OverviewLockedCardOverlayProps = {
  title: string;
  subtitle: string;
  compact?: boolean;
  className?: string;
};

export function OverviewLockedCardOverlay({
  title,
  subtitle,
  compact = false,
  className,
}: OverviewLockedCardOverlayProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center px-2",
        className,
      )}
    >
      <div
        className={cn(
          "flex max-w-full items-center gap-2.5 border border-border bg-card/95 shadow-zynd-mid backdrop-blur-sm sip-lock-panel",
          compact
            ? "h-auto min-h-9 max-w-[calc(100%-0.5rem)] rounded-[var(--radius-control)] px-2.5 py-2"
            : "rounded-[var(--radius-card)] px-3.5 py-3 sm:px-4",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
            compact ? "size-7" : "size-9",
          )}
        >
          <Lock className={compact ? "size-3" : "size-4"} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 text-left">
          <p
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-[11px] leading-none" : "text-compact",
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-muted-foreground",
              compact
                ? "mt-0.5 line-clamp-2 text-[10px] leading-snug"
                : "mt-0.5 text-caption leading-relaxed",
            )}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}

export function OverviewLockedCardBackdrop({ className }: { className?: string }) {
  return <div className={cn("pointer-events-none absolute inset-0 sip-chart-overlay", className)} aria-hidden />;
}
