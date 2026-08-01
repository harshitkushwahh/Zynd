import { parseClientDetailTabId } from "@/components/clients/client-detail-tab-ids";
import {
  getDistributorClientsPageTitle,
  resolveDistributorClientsListScope,
} from "@/lib/distributor-clients-list-scope";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  getDistributorBreadcrumbSegments,
  isDistributorLegacyOperationsPath,
} from "@/lib/distributor-navigation";
import {
  getDistributorOperationsPageTitle,
  resolveDistributorOrdersListScope,
} from "@/lib/distributor-operations-orders-scope";
import { resolveDistributorSettingsSection } from "@/lib/distributor-settings-navigation";

export const DISTRIBUTOR_DOCUMENT_TITLE_SUFFIX = "Zynd Mitra";

export function formatDistributorDocumentTitle(pageLabel: string): string {
  return `${pageLabel} · ${DISTRIBUTOR_DOCUMENT_TITLE_SUFFIX}`;
}

export type DocumentTitleSearchParams = { get(name: string): string | null };

export function applyDistributorDocumentTitle(
  pathname: string,
  searchParams?: DocumentTitleSearchParams,
): void {
  const pageLabel = resolveDistributorDocumentTitle(pathname, searchParams);
  const nextTitle = formatDistributorDocumentTitle(pageLabel);
  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
}

function resolveSettingsDocumentTitle(pathname: string): string | null {
  if (!pathname.startsWith("/dashboard/settings")) return null;
  const sectionSlug = pathname.split("/").filter(Boolean)[2];
  return resolveDistributorSettingsSection(sectionSlug).title;
}

function resolveYourClientsListTitle(
  pathname: string,
  searchParams?: DocumentTitleSearchParams,
): string | null {
  if (pathname !== "/dashboard/your-clients") return null;
  const scope = resolveDistributorClientsListScope(searchParams?.get("clientsScope"));
  return getDistributorClientsPageTitle(scope);
}

function resolveYourOperationsDocumentTitle(
  pathname: string,
  searchParams?: DocumentTitleSearchParams,
): string | null {
  if (
    !pathname.startsWith("/dashboard/your-operations") &&
    !isDistributorLegacyOperationsPath(pathname)
  ) {
    return null;
  }

  const scope = resolveDistributorOrdersListScope(searchParams?.get("ordersScope"));
  return getDistributorOperationsPageTitle(scope);
}

function resolveClientDetailTabSuffix(
  pathname: string,
  searchParams?: { get(name: string): string | null },
): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const isYourBookClient =
    parts[0] === "dashboard" && parts[1] === "your-clients" && parts[2] && parts[2] !== "resident" && parts[2] !== "nri";
  const isSystemResidentClient =
    parts[0] === "dashboard" &&
    parts[1] === "investors" &&
    parts[2] === "resident" &&
    parts[3] &&
    parts[4] !== "family";

  if (!isYourBookClient && !isSystemResidentClient) return null;
  if (parts.includes("family")) return null;

  const tab = parseClientDetailTabId(searchParams?.get("tab"));
  if (!tab || tab === "portfolio") return null;

  const tabLabels = DISTRIBUTOR_CLIENT_COPY.tabs;
  switch (tab) {
    case "kyc":
      return tabLabels.kyc;
    case "documents":
      return tabLabels.documents;
    case "risk":
      return tabLabels.risk;
    case "goals":
      return tabLabels.goals;
    case "family":
      return tabLabels.family;
    case "transactions":
      return tabLabels.transactions;
    default:
      return null;
  }
}

/** Resolves the page label shown before `· Zynd Mitra` in the browser tab. */
export function resolveDistributorDocumentTitle(
  pathname: string,
  searchParams?: DocumentTitleSearchParams,
): string {
  const settingsTitle = resolveSettingsDocumentTitle(pathname);
  if (settingsTitle) return settingsTitle;

  const operationsTitle = resolveYourOperationsDocumentTitle(pathname, searchParams);
  if (operationsTitle) return operationsTitle;

  const clientsListTitle = resolveYourClientsListTitle(pathname, searchParams);
  if (clientsListTitle) return clientsListTitle;

  const segments = getDistributorBreadcrumbSegments(pathname, searchParams);
  const baseLabel = segments.at(-1)?.label ?? "Dashboard";
  const tabSuffix = resolveClientDetailTabSuffix(pathname, searchParams);

  if (tabSuffix && !baseLabel.includes(tabSuffix)) {
    return `${baseLabel} · ${tabSuffix}`;
  }

  return baseLabel;
}
