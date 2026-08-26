import type {
  DistributorOrder,
  DistributorSystematicPlan,
  DistributorTransactionGroup,
  DistributorTxnRequest,
} from "@/lib/distributor-types";

export type OrdersListScope = "your-book" | "all";
export type SystematicPlansListScope = "your-book" | "all";
export type TxnRequestsListScope = "your-book" | "all";
export type TransactionGroupsListScope = "your-book" | "all";

export function getOrdersForListScope(_scope: OrdersListScope): DistributorOrder[] {
  return [];
}

export function getSystematicPlansForListScope(
  _scope: SystematicPlansListScope,
): DistributorSystematicPlan[] {
  return [];
}

export function getTxnRequestsForListScope(
  requests: DistributorTxnRequest[],
  scope: TxnRequestsListScope,
): DistributorTxnRequest[] {
  const book = requests.filter((request) => request.inDistributorBook !== false);
  return scope === "all" ? book : book;
}

export function getTransactionGroupsForListScope(
  _scope: TransactionGroupsListScope,
): DistributorTransactionGroup[] {
  return [];
}

export const DUMMY_ORDERS: import("@/lib/distributor-types").DistributorOrder[] = [];
export const DUMMY_SYSTEMATIC_PLANS: import("@/lib/distributor-types").DistributorSystematicPlan[] = [];
export const DUMMY_TXN_REQUESTS: import("@/lib/distributor-types").DistributorTxnRequest[] = [];
export const DUMMY_TRANSACTION_GROUPS: import("@/lib/distributor-types").DistributorTransactionGroup[] = [];
