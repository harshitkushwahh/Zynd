import type { DistributorOperationsSectionId } from "@/lib/distributor-operations-sections";
import { distributorOperationsSectionHref } from "@/lib/distributor-operations-variants";
import type { DistributorOrder, DistributorTxnRequest } from "@/lib/dummy/types";
import { getOrdersForListScope } from "@/lib/dummy/orders";
import { getSystematicPlansForListScope } from "@/lib/dummy/systematic-plans";
import { getTransactionGroupsForListScope } from "@/lib/dummy/transaction-groups";
import { getTxnRequestsForListScope } from "@/lib/dummy/txn-requests";

/** Your operations list scope: distributor book vs entire platform. */
export type DistributorOrdersListScope = "your-book" | "all";

export const DISTRIBUTOR_ORDERS_LIST_SCOPES: {
  id: DistributorOrdersListScope;
  label: string;
}[] = [
  { id: "your-book", label: "Your book" },
  { id: "all", label: "All orders" },
];

export function isDistributorOrdersListScope(value: string): value is DistributorOrdersListScope {
  return value === "your-book" || value === "all";
}

export function resolveDistributorOrdersListScope(
  raw: string | null | undefined,
): DistributorOrdersListScope {
  return raw === "all" ? "all" : "your-book";
}

export function getDistributorOrdersListScopeLabel(scope: DistributorOrdersListScope): string {
  return (
    DISTRIBUTOR_ORDERS_LIST_SCOPES.find((entry) => entry.id === scope)?.label ?? "Your book"
  );
}

export function getDistributorOperationsPageTitle(scope: DistributorOrdersListScope): string {
  return scope === "all" ? "All orders" : "Your operations";
}

export function getScopedOrders(scope: DistributorOrdersListScope): DistributorOrder[] {
  return getOrdersForListScope(scope);
}

export function getScopedSystematicPlans(scope: DistributorOrdersListScope) {
  return getSystematicPlansForListScope(scope);
}

export function getScopedTxnRequests(
  requests: DistributorTxnRequest[],
  scope: DistributorOrdersListScope,
) {
  return getTxnRequestsForListScope(requests, scope);
}

export function getScopedTransactionGroups(scope: DistributorOrdersListScope) {
  return getTransactionGroupsForListScope(scope);
}

export function buildYourOperationsVariantHref(
  sectionId: DistributorOperationsSectionId,
  variantId: string,
  listScope?: DistributorOrdersListScope,
): string {
  const base = distributorOperationsSectionHref(sectionId, variantId);
  if (listScope === "all") {
    return `${base}?ordersScope=all`;
  }
  return base;
}
