"use client";

import { useState } from "react";

import { MfCasImportDialog } from "@/features/invest/components/mf-cas-import-dialog";
import { MfPopularToolsCard } from "@/features/invest/components/mf-popular-tools-card";
import { MfYourInvestedCard } from "@/features/invest/components/mf-your-invested-card";
import { usePortfolioHoldingsQuery, usePortfolioSummaryQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { MF_POPULAR_TOOLS } from "@/features/invest/lib/mf-dashboard-sidebar-data";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfDashboardSidebarProps = {
  className?: string;
};

export function MfDashboardSidebar({ className }: MfDashboardSidebarProps) {
  const { summary } = usePortfolioSummaryQuery();
  const { holdings } = usePortfolioHoldingsQuery();
  const [casOpen, setCasOpen] = useState(false);
  const casAllowed =
    summary?.has_allotted_investment === true ||
    holdings.some((row) => row.source !== "external");
  const tools = MF_POPULAR_TOOLS.map((tool) =>
    tool.id === "cas-import"
      ? {
          ...tool,
          disabled: !casAllowed,
          description: casAllowed ? tool.description : copy.mutualFunds.casLockedUntilInvestment,
        }
      : tool,
  );

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col gap-3 xl:w-[21rem] xl:sticky xl:top-6 xl:self-start",
        className,
      )}
    >
      <MfYourInvestedCard />
      <MfPopularToolsCard
        tools={tools}
        onCasImport={() => {
          if (!casAllowed) return;
          setCasOpen(true);
        }}
      />
      <MfCasImportDialog open={casOpen} onOpenChange={setCasOpen} />
    </aside>
  );
}
