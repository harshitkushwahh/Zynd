import {
  DISTRIBUTOR_NAV_FLAT,
  type DistributorNavItem,
} from "@/lib/distributor-navigation";
import {
  distributorClientDetailHrefForInvestor,
  type DistributorClientListOrigin,
} from "@/lib/distributor-client-routes";
import { searchInvestors } from "@/lib/distributor-investor-utils";
import type {
  DistributorInvestor,
  DistributorOrder,
  DistributorSystematicPlan,
  DistributorTransactionGroup,
  DistributorTxnRequest,
} from "@/lib/distributor-types";

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
  return distributorClientDetailHrefForInvestor(origin, investor);
}

export function searchDistributorInvestors(
  source: DistributorInvestor[],
  query: string,
): DistributorInvestor[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return searchInvestors(source, normalized).slice(0, RESULT_LIMIT);
}

export function searchDistributorInvestorsInList(
  source: DistributorInvestor[],
  query: string,
): DistributorInvestor[] {
  return searchDistributorInvestors(source, query);
}

export function searchDistributorOrders(_query: string, _orders: DistributorOrder[] = []): DistributorOrder[] {
  return [];
}

export function searchDistributorSystematicPlans(
  _query: string,
  _plans: DistributorSystematicPlan[] = [],
): DistributorSystematicPlan[] {
  return [];
}

export function searchDistributorTxnRequests(
  query: string,
  requests: DistributorTxnRequest[] = [],
): DistributorTxnRequest[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return requests.filter((request) => {
    const haystack = `${request.requestRef} ${request.clientCode} ${request.investorEmailMasked} ${request.requestType} ${request.status}`;
    return includesQuery(haystack, normalized);
  }).slice(0, RESULT_LIMIT);
}

export function searchDistributorTransactionGroups(
  _query: string,
  _groups: DistributorTransactionGroup[] = [],
): DistributorTransactionGroup[] {
  return [];
}
