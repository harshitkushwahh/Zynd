import type { DistributorOperationsSectionId } from "@/lib/distributor-operations-sections";
import type { DistributorOrdersListScope } from "@/lib/distributor-operations-orders-scope";
import {
  getScopedOrders,
  getScopedSystematicPlans,
  getScopedTransactionGroups,
  getScopedTxnRequests,
} from "@/lib/distributor-operations-orders-scope";
import type { DistributorOrder, DistributorTxnRequest } from "@/lib/distributor-types";
import { getDistributorOperationsVariants } from "@/lib/distributor-operations-variants";

function orderChannel(order: DistributorOrder): "one-time" | "sip" | "redemption" {
  if (order.operationChannel) return order.operationChannel;
  if (order.orderType === "Redeem") return "redemption";
  return "one-time";
}

function countOrdersVariant(orders: DistributorOrder[], variantId: string): number {
  return orders.filter((order) => orderChannel(order) === variantId).length;
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

function txnRequestVariantId(request: DistributorTxnRequest): string {
  if (request.requestType === "SIP Register") return "sip";
  if (request.requestType === "Folio Update") return "group-transaction";
  if (request.requestType === "Purchase" || request.requestType === "Redeem") return "one-time";
  return "one-time";
}

function countTxnRequestsVariant(requests: DistributorTxnRequest[], variantId: string): number {
  return requests.filter((request) => txnRequestVariantId(request) === variantId).length;
}

function countTransactionGroupsVariant(
  groups: ReturnType<typeof getScopedTransactionGroups>,
  variantId: string,
): number {
  if (variantId === "sip") {
    return groups.filter((group) => /sip/i.test(group.label)).length;
  }
  return groups.filter((group) => !/sip/i.test(group.label)).length;
}

export function getOperationsVariantCount(
  sectionId: DistributorOperationsSectionId,
  variantId: string,
  scope: DistributorOrdersListScope,
  txnRequests: DistributorTxnRequest[],
): number {
  switch (sectionId) {
    case "orders":
      return countOrdersVariant(getScopedOrders(scope), variantId);
    case "systematic-plans":
      return countPlansVariant(getScopedSystematicPlans(scope), variantId);
    case "txn-requests":
      return countTxnRequestsVariant(getScopedTxnRequests(txnRequests, scope), variantId);
    case "transaction-groups":
      return countTransactionGroupsVariant(getScopedTransactionGroups(scope), variantId);
    default:
      return 0;
  }
}

export function getOperationsVariantCountMap(
  sectionId: DistributorOperationsSectionId,
  scope: DistributorOrdersListScope,
  txnRequests: DistributorTxnRequest[],
): Record<string, number> {
  const variants = getDistributorOperationsVariants(sectionId);
  return Object.fromEntries(
    variants.map((variant) => [
      variant.id,
      getOperationsVariantCount(sectionId, variant.id, scope, txnRequests),
    ]),
  );
}
