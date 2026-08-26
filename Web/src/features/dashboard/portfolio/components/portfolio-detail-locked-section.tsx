"use client";

import type { ReactNode } from "react";

import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import { cn } from "@/lib/utils";

type PortfolioDetailLockedSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function PortfolioDetailLockedSection({
  title,
  subtitle,
  children,
  className,
}: PortfolioDetailLockedSectionProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-[1.75rem]", className)}>
      <div className="pointer-events-none select-none blur-[5px]">{children}</div>
      <OverviewLockedCardBackdrop className="inset-0" />
      <OverviewLockedCardOverlay className="inset-0" title={title} subtitle={subtitle} />
    </div>
  );
}
