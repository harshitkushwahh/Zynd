"use client";

import Link from "next/link";
import { CalendarDays, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { getDaypartGreeting } from "@/lib/get-daypart-greeting";
import { cn } from "@/lib/utils";

const ADD_CLIENT_HREF = "/dashboard/add-investor";

const dashboardDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDashboardDate(date: Date): string {
  return dashboardDateFormatter.format(date);
}

export type DistributorDashboardGreetingProps = {
  name: string;
  className?: string;
};

export function DistributorDashboardGreeting({ name, className }: DistributorDashboardGreetingProps) {
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
        <DistributorActionButton
          variant="primary"
          nativeButton={false}
          render={<Link href={ADD_CLIENT_HREF} />}
        >
          <UserPlus className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          Add client
        </DistributorActionButton>
      </div>
    </header>
  );
}
