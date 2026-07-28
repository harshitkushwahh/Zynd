"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import { OrdersPanel } from "@/components/orders/orders-panel";
import { SystematicPlansPanel } from "@/components/systematic-plans/systematic-plans-panel";
import { TransactionGroupsPanel } from "@/components/transaction-groups/transaction-groups-panel";
import { TxnRequestsPanel } from "@/components/txn-requests/txn-requests-panel";
import { YourOperationsSectionMetrics } from "@/components/workspace/your-operations-section-metrics";
import { YourOperationsSidebar } from "@/components/workspace/your-operations-sidebar";
import {
  distributorOperationsSectionHref,
  resolveDistributorOperationsSection,
  type DistributorOperationsSectionId,
} from "@/lib/distributor-operations-sections";
import { resolveDistributorOperationsVariant } from "@/lib/distributor-operations-variants";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_WORKSPACE_SPLIT_CLASS,
  DISTRIBUTOR_WORKSPACE_SPLIT_MAIN_CLASS,
} from "@/lib/distributor-layout";

type YourOperationsPageProps = {
  sectionSlug?: string;
  variantSlug?: string;
};

export function YourOperationsPage({ sectionSlug, variantSlug }: YourOperationsPageProps) {
  const router = useRouter();
  const activeSection = resolveDistributorOperationsSection(sectionSlug);
  const pageConfig = DISTRIBUTOR_PAGE_CONFIG.yourOperations;
  const PageIcon = resolveDistributorPageIcon(pageConfig.iconName);
  const sectionId = activeSection?.id as DistributorOperationsSectionId | undefined;
  const activeVariant =
    sectionId && variantSlug
      ? resolveDistributorOperationsVariant(sectionId, variantSlug)
      : sectionId
        ? resolveDistributorOperationsVariant(sectionId)
        : null;

  useEffect(() => {
    if (!activeSection || !sectionId) return;
    const canonicalHref = distributorOperationsSectionHref(
      sectionId,
      activeVariant?.id ?? resolveDistributorOperationsVariant(sectionId)?.id,
    );
    if (!variantSlug || !activeVariant || variantSlug !== activeVariant.id) {
      router.replace(canonicalHref);
      return;
    }
    if (sectionSlug !== activeSection.id) {
      router.replace(canonicalHref);
    }
  }, [activeSection, activeVariant, router, sectionId, sectionSlug, variantSlug]);

  if (!activeSection || !sectionId || !activeVariant) {
    return null;
  }

  const tableLayout = { layout: "table" as const };

  const sectionContent = (() => {
    switch (activeSection.id) {
      case "orders":
        return <OrdersPanel {...DISTRIBUTOR_PAGE_CONFIG.orders} {...tableLayout} />;
      case "systematic-plans":
        return (
          <SystematicPlansPanel {...DISTRIBUTOR_PAGE_CONFIG.systematicPlans} {...tableLayout} />
        );
      case "txn-requests":
        return <TxnRequestsPanel {...DISTRIBUTOR_PAGE_CONFIG.txnRequests} {...tableLayout} />;
      case "transaction-groups":
        return (
          <TransactionGroupsPanel {...DISTRIBUTOR_PAGE_CONFIG.transactionGroups} {...tableLayout} />
        );
      default:
        return null;
    }
  })();

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        icon={PageIcon}
        title={pageConfig.title}
        description={pageConfig.description}
      />

      <YourOperationsSectionMetrics
        sectionId={activeSection.id as DistributorOperationsSectionId}
      />

      <div className={DISTRIBUTOR_WORKSPACE_SPLIT_CLASS}>
        <YourOperationsSidebar />
        <div className={DISTRIBUTOR_WORKSPACE_SPLIT_MAIN_CLASS}>{sectionContent}</div>
      </div>
    </div>
  );
}
