import { YOUR_CLIENTS_LIST_HREF } from "@/lib/distributor-client-routes";
import type { DistributorInvestor } from "@/lib/dummy/types";
import {
  filterDistributorBookInvestors,
  filterSystemResidentInvestors,
} from "@/lib/dummy/investors";

/** Your clients list scope: distributor book vs platform-wide residents. */
export type DistributorClientsListScope = "your-book" | "all";

export const DISTRIBUTOR_CLIENTS_LIST_SCOPES: {
  id: DistributorClientsListScope;
  label: string;
}[] = [
  { id: "your-book", label: "Your clients" },
  { id: "all", label: "All investors" },
];

export function isDistributorClientsListScope(value: string): value is DistributorClientsListScope {
  return value === "your-book" || value === "all";
}

export function resolveDistributorClientsListScope(
  raw: string | null | undefined,
): DistributorClientsListScope {
  return raw === "all" ? "all" : "your-book";
}

export function getDistributorClientsPageTitle(scope: DistributorClientsListScope): string {
  return scope === "all" ? "All investors" : "Your clients";
}

export function buildYourClientsListHref(scope?: DistributorClientsListScope): string {
  if (scope === "all") {
    return `${YOUR_CLIENTS_LIST_HREF}?clientsScope=all`;
  }
  return YOUR_CLIENTS_LIST_HREF;
}

export function getDistributorClientsListScopeLeadTile(
  scope: DistributorClientsListScope,
  investors: readonly DistributorInvestor[],
): { label: string; value: number; hint: string } {
  const rows = [...investors];
  if (scope === "all") {
    const platform = filterSystemResidentInvestors(rows);
    return {
      label: "All investors",
      value: platform.length,
      hint: "Platform-wide (demo)",
    };
  }
  const book = filterDistributorBookInvestors(rows);
  return {
    label: "Your clients",
    value: book.length,
    hint: "Added by you",
  };
}
