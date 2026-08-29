import type { DistributorOperationsSectionId } from "@/lib/distributor-operations-sections";
import { distributorOperationsSectionHref } from "@/lib/distributor-operations-variants";
import type { DistributorOrder, DistributorTxnRequest } from "@/lib/distributor-types";
import { getOrdersForListScope } from "@/lib/distributor-operations-list-data";
import { getSystematicPlansForListScope } from "@/lib/distributor-operations-list-data";
import { getTransactionGroupsForListScope } from "@/lib/distributor-operations-list-data";
import { getTxnRequestsForListScope } from "@/lib/distributor-operations-list-data";

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

export function getScopedOrders(
  orders: DistributorOrder[],
  scope: DistributorOrdersListScope,
): DistributorOrder[] {
  return getOrdersForListScope(orders, scope);
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

export function getScopedTransactionGroups(
  groups: DistributorTransactionGroup[],
  scope: DistributorOrdersListScope,
) {
  return getTransactionGroupsForListScope(groups, scope);
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
