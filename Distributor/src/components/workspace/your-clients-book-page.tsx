"use client";

import { useSearchParams } from "next/navigation";

import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { InvestorsPanel } from "@/components/investors/investors-panel";
import { DistributorClientsListScopeTabs } from "@/components/workspace/distributor-clients-list-scope-tabs";
import { useYourClientsScopeSwitch } from "@/components/workspace/use-your-clients-scope-switch";
import { YourClientsBookMetrics } from "@/components/workspace/your-clients-book-metrics";
import { YourClientsBookMetricsSkeleton } from "@/components/workspace/your-clients-book-metrics-skeleton";
import { DistributorScopeTableSkeleton } from "@/components/workspace/distributor-scope-table-skeleton";
import { useClientPageReveal } from "@/components/clients/use-client-page-reveal";
import {
  getDistributorClientsPageTitle,
  resolveDistributorClientsListScope,
} from "@/lib/distributor-clients-list-scope";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

export function YourClientsBookPage() {
  const searchParams = useSearchParams();
  const urlScope = resolveDistributorClientsListScope(searchParams.get("clientsScope"));
  const { displayScope, setListScope, isSwitching, showTableSkeleton } = useYourClientsScopeSwitch({
    urlScope,
  });
  const { showSkeleton: showInitialReveal } = useClientPageReveal({
    ready: true,
    resetKey: "your-clients-book",
  });
  const showScopeSkeleton = showTableSkeleton || (showInitialReveal && !isSwitching);

  const pageTitle = getDistributorClientsPageTitle(displayScope);
  const pageConfig = DISTRIBUTOR_PAGE_CONFIG.yourClients;
  const isAllInvestors = displayScope === "all";

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        title={pageTitle}
        titleSwitchKey={displayScope}
        description={pageConfig.description}
        className={cn(isSwitching && "distributor-page-header--scope-switching")}
      >
        <DistributorClientsListScopeTabs
          value={displayScope}
          onChange={setListScope}
          busy={isSwitching}
        />
      </DistributorPageHeader>

      {showScopeSkeleton ? (
        <>
          <YourClientsBookMetricsSkeleton />
          <DistributorScopeTableSkeleton
            ariaLabel="Loading client list"
            filterPlaceholderCount={4}
            className="distributor-your-clients-scope-panel__layer--skeleton"
          />
        </>
      ) : (
        <>
          <YourClientsBookMetrics listScope={displayScope} />

          <div
            key={displayScope}
            className="distributor-your-clients-scope-panel distributor-your-clients-scope-panel__layer"
          >
            <InvestorsPanel
              {...(isAllInvestors
                ? DISTRIBUTOR_PAGE_CONFIG.residentInvestors
                : DISTRIBUTOR_PAGE_CONFIG.yourClientsTable)}
              investorScope={isAllInvestors ? "system-residents" : "distributor-book"}
              listOrigin={isAllInvestors ? "system-resident" : "your-book"}
              showServiceModel={isAllInvestors}
              showServiceModelFilter={isAllInvestors}
              layout="table"
            />
          </div>
        </>
      )}
    </div>
  );
}
