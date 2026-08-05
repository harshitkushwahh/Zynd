import {
  DISTRIBUTOR_NAV_FLAT,
  type DistributorNavItem,
} from "@/lib/distributor-navigation";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import { distributorClientDetailHref } from "@/lib/distributor-client-routes";
import { DUMMY_INVESTORS, searchInvestors } from "@/lib/dummy/investors";
import { DUMMY_ORDERS } from "@/lib/dummy/orders";
import { DUMMY_SYSTEMATIC_PLANS } from "@/lib/dummy/systematic-plans";
import { DUMMY_TRANSACTION_GROUPS } from "@/lib/dummy/transaction-groups";
import { DUMMY_TXN_REQUESTS } from "@/lib/dummy/txn-requests";
import type {
  DistributorInvestor,
  DistributorOrder,
  DistributorSystematicPlan,
  DistributorTransactionGroup,
  DistributorTxnRequest,
} from "@/lib/dummy/types";

const RESULT_LIMIT = 6;

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function includesQuery(haystack: string, query: string) {
  return haystack.toLowerCase().includes(query);
}

export function searchDistributorPages(query: string): DistributorNavItem[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return DISTRIBUTOR_NAV_FLAT;
  return DISTRIBUTOR_NAV_FLAT.filter((route) => {
    const haystack = `${route.label} ${route.description} ${route.href}`;
    return includesQuery(haystack, normalized);
  });
}

export function getInvestorListHref(investor: DistributorInvestor): string {
  const origin: DistributorClientListOrigin = investor.inDistributorBook
    ? "your-book"
    : "system-resident";
  return distributorClientDetailHref(origin, investor.id);
}

export function searchDistributorInvestors(query: string): DistributorInvestor[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return searchInvestors(DUMMY_INVESTORS, normalized).slice(0, RESULT_LIMIT);
}

export function searchDistributorInvestorsInList(
  source: DistributorInvestor[],
  query: string,
): DistributorInvestor[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return searchInvestors(source, normalized).slice(0, RESULT_LIMIT);
}

export function searchDistributorOrders(query: string): DistributorOrder[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return DUMMY_ORDERS.filter((order) => {
    const haystack = `${order.orderRef} ${order.clientCode} ${order.investorEmailMasked} ${order.schemeName} ${order.orderType} ${order.status}`;
    return includesQuery(haystack, normalized);
  }).slice(0, RESULT_LIMIT);
}

export function searchDistributorSystematicPlans(
  query: string,
): DistributorSystematicPlan[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return DUMMY_SYSTEMATIC_PLANS.filter((plan) => {
    const haystack = `${plan.planRef} ${plan.clientCode} ${plan.investorEmailMasked} ${plan.schemeName} ${plan.planType} ${plan.status}`;
    return includesQuery(haystack, normalized);
  }).slice(0, RESULT_LIMIT);
}

export function searchDistributorTxnRequests(
  query: string,
  requests: DistributorTxnRequest[] = DUMMY_TXN_REQUESTS,
): DistributorTxnRequest[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return requests.filter((request) => {
    const haystack = `${request.requestRef} ${request.clientCode} ${request.investorEmailMasked} ${request.requestType} ${request.status}`;
    return includesQuery(haystack, normalized);
  }).slice(0, RESULT_LIMIT);
}

export function searchDistributorTransactionGroups(
  query: string,
): DistributorTransactionGroup[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return DUMMY_TRANSACTION_GROUPS.filter((group) => {
    const haystack = `${group.groupRef} ${group.label} ${group.status}`;
    return includesQuery(haystack, normalized);
  }).slice(0, RESULT_LIMIT);
}