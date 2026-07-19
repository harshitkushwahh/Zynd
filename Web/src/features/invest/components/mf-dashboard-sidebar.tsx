"use client";

import { MfPopularToolsCard } from "@/features/invest/components/mf-popular-tools-card";
import { MfYourInvestedCard } from "@/features/invest/components/mf-your-invested-card";
import { cn } from "@/lib/utils";

type MfDashboardSidebarProps = {
  className?: string;
};

export function MfDashboardSidebar({ className }: MfDashboardSidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col gap-4 xl:w-[21rem] xl:sticky xl:top-6 xl:self-start",
        className,
      )}
    >
      <MfYourInvestedCard />
      <MfPopularToolsCard />
    </aside>
  );
}
