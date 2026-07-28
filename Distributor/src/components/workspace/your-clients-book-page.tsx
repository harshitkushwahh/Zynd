"use client";

import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import { InvestorsPanel } from "@/components/investors/investors-panel";
import { YourClientsBookMetrics } from "@/components/workspace/your-clients-book-metrics";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";

export function YourClientsBookPage() {
  const pageConfig = DISTRIBUTOR_PAGE_CONFIG.yourClients;
  const PageIcon = resolveDistributorPageIcon(pageConfig.iconName);

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader icon={PageIcon} title={pageConfig.title} description={pageConfig.description} />

      <YourClientsBookMetrics />

      <InvestorsPanel
        {...DISTRIBUTOR_PAGE_CONFIG.yourClientsTable}
        investorScope="distributor-book"
        listOrigin="your-book"
        layout="table"
      />
    </div>
  );
}
