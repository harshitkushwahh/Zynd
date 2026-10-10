"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { getDaypartGreeting } from "@/lib/get-daypart-greeting";
import { cn } from "@/lib/utils";

const dashboardDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDashboardDate(date: Date): string {
  return dashboardDateFormatter.format(date);
}

export type SupportDashboardGreetingProps = {
  name: string;
  className?: string;
};

export function SupportDashboardGreeting({ name, className }: SupportDashboardGreetingProps) {
  const [greeting, setGreeting] = useState(() => getDaypartGreeting());
  const [dateLabel, setDateLabel] = useState(() => formatDashboardDate(new Date()));

  useEffect(() => {
    const tick = () => {
      setGreeting(getDaypartGreeting());
      setDateLabel(formatDashboardDate(new Date()));
    };
    tick();
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className={cn("distributor-dashboard-greeting", className)}>
      <p className="distributor-dashboard-greeting__text" suppressHydrationWarning>
        {greeting}, {name}
      </p>
      <div className="distributor-dashboard-greeting__actions">
        <DistributorActionButton variant="date" aria-label={`Selected date, ${dateLabel}`}>
          <CalendarDays className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="tabular-nums" suppressHydrationWarning>
            {dateLabel}
          </span>
        </DistributorActionButton>
      </div>
    </header>
  );
}
