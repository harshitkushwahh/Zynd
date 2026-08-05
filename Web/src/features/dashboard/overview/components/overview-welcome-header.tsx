"use client";

import { useLayoutEffect, useState } from "react";

import { PageTitle } from "@/components/ui/page-title";
import { resolveTimeGreeting, type TimeGreeting } from "@/features/dashboard/overview/lib/time-greeting";

type OverviewWelcomeHeaderProps = {
  name: string;
};

export function OverviewWelcomeHeader({ name }: OverviewWelcomeHeaderProps) {
  const [greeting, setGreeting] = useState<TimeGreeting | null>(null);

  useLayoutEffect(() => {
    const updateGreeting = () => {
      setGreeting(resolveTimeGreeting(new Date(), name));
    };

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(intervalId);
  }, [name]);

  return (
    <div className="mb-4">
      <PageTitle suppressHydrationWarning className="font-normal">
        {greeting?.label}
      </PageTitle>
    </div>
  );
}
