"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";

import type { PortfolioUpcomingSip } from "@/features/dashboard/portfolio/lib/portfolio-api";
import { portfolioTabHref } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import { formatDate, formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function formatDaysUntil(dateValue: string) {
  const target = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return copy.dashboard.portfolio.overviewUpcomingSipsToday;
  if (diffDays === 1) return copy.dashboard.portfolio.overviewUpcomingSipsTomorrow;
  return copy.dashboard.portfolio.overviewUpcomingSipsDaysUntil.replace("{days}", String(diffDays));
}

type PortfolioUpcomingSipsPanelProps = {
  upcomingSips: PortfolioUpcomingSip[];
  className?: string;
};

export function PortfolioUpcomingSipsPanel({ upcomingSips, className }: PortfolioUpcomingSipsPanelProps) {
  if (upcomingSips.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-border/70 bg-card p-4 shadow-zynd-low",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-compact font-semibold text-foreground">
            {copy.dashboard.portfolio.overviewUpcomingSipsTitle}
          </h3>
        </div>
        <Link href={portfolioTabHref("sips")} className="text-caption font-medium text-primary hover:underline">
          {copy.dashboard.overview.sipsViewAll}
        </Link>
      </div>

      <div className="space-y-2">
        {upcomingSips.map((sip) => (
          <div
            key={sip.plan_id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border/60 bg-muted/10 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-compact font-medium text-foreground">
                {sip.product_name ?? copy.mutualFunds.unknownFund}
              </p>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {formatDate(sip.next_installment_date)} · {formatDaysUntil(sip.next_installment_date ?? "")}
              </p>
            </div>
            <p className="shrink-0 text-compact font-semibold tabular-nums text-foreground">
              {formatInr(sip.amount_inr)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
