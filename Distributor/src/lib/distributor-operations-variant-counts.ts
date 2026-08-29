import type { DistributorOperationsSectionId } from "@/lib/distributor-operations-sections";
import type { DistributorOrdersListScope } from "@/lib/distributor-operations-orders-scope";
import {
  getScopedOrders,
  getScopedSystematicPlans,
  getScopedTransactionGroups,
  getScopedTxnRequests,
} from "@/lib/distributor-operations-orders-scope";
import type { DistributorOrder, DistributorTransactionGroup, DistributorTxnRequest } from "@/lib/distributor-types";
import { getDistributorOperationsVariants } from "@/lib/distributor-operations-variants";
import { orderVariantId } from "@/lib/map-distributor-order";
import {
  transactionGroupVariantId,
  txnRequestVariantId,
} from "@/lib/map-mitra-txn-recommendation";

function countOrdersVariant(orders: DistributorOrder[], variantId: string): number {
  return orders.filter((order) => orderVariantId(order) === variantId).length;
}

function countPlansVariant(
  plans: ReturnType<typeof getScopedSystematicPlans>,
  variantId: string,
): number {
  const typeMap: Record<string, string> = {
    sip: "SIP",
    stp: "STP",
    swp: "SWP",
  };
  const planType = typeMap[variantId];
  if (!planType) return 0;
  return plans.filter((plan) => plan.planType === planType).length;
}

function countTxnRequestsVariant(requests: DistributorTxnRequest[], variantId: string): number {
  return requests.filter((request) => txnRequestVariantId(request) === variantId).length;
}

function countTransactionGroupsVariant(
  groups: DistributorTransactionGroup[],
  variantId: string,
): number {
  return groups.filter((group) => transactionGroupVariantId(group) === variantId).length;
}

export function getOperationsVariantCount(
  sectionId: DistributorOperationsSectionId,
  variantId: string,
  scope: DistributorOrdersListScope,
  txnRequests: DistributorTxnRequest[],
  transactionGroups: DistributorTransactionGroup[],
  orders: DistributorOrder[],
): number {
  switch (sectionId) {
    case "orders":
      return countOrdersVariant(getScopedOrders(orders, scope), variantId);
    case "systematic-plans":
      return countPlansVariant(getScopedSystematicPlans(scope), variantId);
    case "txn-requests":
      return countTxnRequestsVariant(getScopedTxnRequests(txnRequests, scope), variantId);
    case "transaction-groups":
      return countTransactionGroupsVariant(getScopedTransactionGroups(transactionGroups, scope), variantId);
    default:
      return 0;
  }
}

export function getOperationsVariantCountMap(
  sectionId: DistributorOperationsSectionId,
  scope: DistributorOrdersListScope,
  txnRequests: DistributorTxnRequest[],
  transactionGroups: DistributorTransactionGroup[],
  orders: DistributorOrder[],
): Record<string, number> {
  const variants = getDistributorOperationsVariants(sectionId);
  return Object.fromEntries(
    variants.map((variant) => [
      variant.id,
      getOperationsVariantCount(sectionId, variant.id, scope, txnRequests, transactionGroups, orders),
    ]),
  );
}
