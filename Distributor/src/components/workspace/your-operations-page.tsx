"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { useClientPageReveal } from "@/components/clients/use-client-page-reveal";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { OrdersPanel } from "@/components/orders/orders-panel";
import { SystematicPlansPanel } from "@/components/systematic-plans/systematic-plans-panel";
import { TransactionGroupsPanel } from "@/components/transaction-groups/transaction-groups-panel";
import { TxnRequestsPanel } from "@/components/txn-requests/txn-requests-panel";
import { DistributorOperationsOrdersScopeTabs } from "@/components/workspace/distributor-operations-orders-scope-tabs";
import { DistributorScopeTableSkeleton } from "@/components/workspace/distributor-scope-table-skeleton";
import { YourOperationsPageSkeleton } from "@/components/workspace/your-operations-page-skeleton";
import { useDistributorListScopeSwitch } from "@/components/workspace/use-distributor-list-scope-switch";
import { YourOperationsSectionMetrics } from "@/components/workspace/your-operations-section-metrics";
import { YourOperationsSidebar } from "@/components/workspace/your-operations-sidebar";
import {
  resolveDistributorOperationsSection,
  type DistributorOperationsSectionId,
} from "@/lib/distributor-operations-sections";
import {
  buildYourOperationsVariantHref,
  getDistributorOperationsPageTitle,
  resolveDistributorOrdersListScope,
  type DistributorOrdersListScope,
} from "@/lib/distributor-operations-orders-scope";
import { resolveDistributorOperationsVariant } from "@/lib/distributor-operations-variants";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_WORKSPACE_SPLIT_CLASS,
  DISTRIBUTOR_WORKSPACE_SPLIT_MAIN_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type YourOperationsPageProps = {
  sectionSlug?: string;
  variantSlug?: string;
};

export function YourOperationsPage({ sectionSlug, variantSlug }: YourOperationsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = resolveDistributorOperationsSection(sectionSlug);
  const pageConfig = DISTRIBUTOR_PAGE_CONFIG.yourOperations;
  const sectionId = activeSection?.id as DistributorOperationsSectionId | undefined;
  const activeVariant =
    sectionId && variantSlug
      ? resolveDistributorOperationsVariant(sectionId, variantSlug)
      : sectionId
        ? resolveDistributorOperationsVariant(sectionId)
        : null;

  const urlScope = resolveDistributorOrdersListScope(searchParams.get("ordersScope"));

  const onScopeNavigate = useCallback(
    (scope: DistributorOrdersListScope) => {
      if (!sectionId || !activeVariant) return;
      router.replace(buildYourOperationsVariantHref(sectionId, activeVariant.id, scope));
    },
    [activeVariant, router, sectionId],
  );

  const { displayScope, setListScope, isSwitching, showTableSkeleton } =
    useDistributorListScopeSwitch({
      urlScope,
      onNavigate: onScopeNavigate,
    });

  const pageReady = Boolean(activeSection && sectionId && activeVariant);
  const pageRevealKey = pageReady ? `${sectionId}-${activeVariant!.id}` : "pending";

  const { showSkeleton: showInitialReveal } = useClientPageReveal({
    ready: pageReady,
    resetKey: pageRevealKey,
  });

  const showContentSkeleton = showInitialReveal && pageReady;

  useEffect(() => {
    if (!activeSection || !sectionId || !activeVariant) return;

    const canonicalHref = buildYourOperationsVariantHref(
      sectionId,
      activeVariant.id,
      urlScope,
    );

    if (!variantSlug || variantSlug !== activeVariant.id) {
      router.replace(canonicalHref);
      return;
    }
    if (sectionSlug !== activeSection.id) {
      router.replace(canonicalHref);
    }
  }, [
    activeSection,
    activeVariant,
    router,
    sectionId,
    sectionSlug,
    urlScope,
    variantSlug,
  ]);

  if (!pageReady || !activeSection || !sectionId || !activeVariant) {
    return (
      <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-scope-page--skeleton")}>
        <YourOperationsPageSkeleton ariaLabel="Loading operations" />
      </div>
    );
  }

  const pageTitle = getDistributorOperationsPageTitle(displayScope);
  const tableLayout = { layout: "table" as const };
  const listScopeProp = { operationsListScope: displayScope };
  const variantProp = { operationsVariantId: activeVariant.id };

  const sectionContent = (() => {
    switch (activeSection.id) {
      case "orders":
        return (
          <OrdersPanel
            {...DISTRIBUTOR_PAGE_CONFIG.orders}
            {...tableLayout}
            {...listScopeProp}
            {...variantProp}
          />
        );
      case "systematic-plans":
        return (
          <SystematicPlansPanel
            {...DISTRIBUTOR_PAGE_CONFIG.systematicPlans}
            {...tableLayout}
            {...listScopeProp}
          />
        );
      case "txn-requests":
        return (
          <TxnRequestsPanel
            {...DISTRIBUTOR_PAGE_CONFIG.txnRequests}
            {...tableLayout}
            {...listScopeProp}
            {...variantProp}
          />
        );
      case "transaction-groups":
        return (
          <TransactionGroupsPanel
            {...DISTRIBUTOR_PAGE_CONFIG.transactionGroups}
            {...tableLayout}
            {...listScopeProp}
            {...variantProp}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div
      className={cn(
        DISTRIBUTOR_PAGE_STACK_CLASS,
        !showContentSkeleton && "distributor-scope-page--enter",
      )}
    >
      <DistributorPageHeader
        title={pageTitle}
        titleSwitchKey={displayScope}
        description={pageConfig.description}
        className={cn(isSwitching && "distributor-page-header--scope-switching")}
      >
        <DistributorOperationsOrdersScopeTabs
          value={displayScope}
          onChange={setListScope}
          busy={isSwitching}
        />
      </DistributorPageHeader>

      {showContentSkeleton ? (
        <YourOperationsPageSkeleton />
      ) : (
        <>
          <YourOperationsSectionMetrics
            sectionId={sectionId}
            operationsListScope={displayScope}
            className={cn(isSwitching && "distributor-scope-metrics-switching")}
          />

          <div className={cn(DISTRIBUTOR_WORKSPACE_SPLIT_CLASS, "distributor-your-operations-workspace")}>
            <YourOperationsSidebar />
            <div className={DISTRIBUTOR_WORKSPACE_SPLIT_MAIN_CLASS}>
              {showTableSkeleton ? (
                <DistributorScopeTableSkeleton
                  ariaLabel="Loading operations table"
                  filterPlaceholderCount={3}
                />
              ) : (
                <div
                  key={`${sectionId}-${displayScope}`}
                  className="distributor-your-clients-scope-panel distributor-your-clients-scope-panel__layer"
                >
                  {sectionContent}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
