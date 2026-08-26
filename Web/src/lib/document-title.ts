import { getDashboardPageMeta } from "@/features/dashboard/navigation/dashboard-routes";
import { getPortfolioTabMeta } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";
import { parsePortfolioPageTab } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import { copy } from "@/shared/config/copy";
import { appTitle } from "@/shared/config/brand";

type SearchParamsLike = Pick<URLSearchParams, "get"> | null | undefined;

const GOAL_LIST_PATHS = new Set(["/dashboard/goals/personal", "/dashboard/goals/family"]);

export function formatDocumentTitle(pageLabel?: string | null): string {
  const trimmed = pageLabel?.trim();
  return trimmed ? appTitle(trimmed) : appTitle();
}

export function applyDocumentTitle(pageLabel?: string | null): void {
  if (typeof document === "undefined") return;
  const nextTitle = formatDocumentTitle(pageLabel);
  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
}

export function extractGoalDetailId(pathname: string): string | null {
  if (!pathname.startsWith("/dashboard/goals/") || GOAL_LIST_PATHS.has(pathname)) {
    return null;
  }
  const segment = pathname.slice("/dashboard/goals/".length).split("/")[0];
  return segment || null;
}

export function extractPortfolioHoldingId(pathname: string): string | null {
  const prefix = "/dashboard/portfolio/";
  if (!pathname.startsWith(prefix)) return null;
  const segment = pathname.slice(prefix.length).split("/")[0];
  if (!segment) return null;
  return segment;
}

export function extractMfCollectionSlug(pathname: string): string | null {
  const prefix = "/dashboard/mutual-funds/collections/";
  if (!pathname.startsWith(prefix)) return null;
  const segment = pathname.slice(prefix.length).split("/")[0];
  return segment || null;
}

/** Static page label from route (+ query) before async data overrides. */
export function resolveDocumentTitleLabel(
  pathname: string,
  searchParams?: SearchParamsLike,
): string {
  if (pathname === "/") {
    return "";
  }

  if (pathname.startsWith("/reset-password")) {
    return copy.resetPassword.title;
  }

  if (pathname.startsWith("/r/")) {
    return copy.auth.joinTitle;
  }

  if (pathname.startsWith("/g/")) {
    return copy.familyGroups.join.title;
  }

  if (!pathname.startsWith("/dashboard")) {
    return "";
  }

  if (pathname.startsWith("/dashboard/mutual-funds/orders/payment-return")) {
    return copy.mutualFunds.orderPayReturnTitle;
  }

  if (/^\/dashboard\/mutual-funds\/orders\/[^/]+\/pay/.test(pathname)) {
    return copy.mutualFunds.orderPayTitle;
  }

  if (/^\/dashboard\/mutual-funds\/cart\/[^/]+\/pay/.test(pathname)) {
    return copy.mutualFunds.orderPayTitle;
  }

  if (pathname.startsWith("/dashboard/mutual-funds/sip/mandate-return")) {
    return copy.mutualFunds.sipMandateTitle;
  }

  if (pathname.startsWith("/dashboard/mutual-funds/sip/first-installment-return")) {
    return copy.mutualFunds.sipMandateTitle;
  }

  if (/^\/dashboard\/mutual-funds\/sip\/[^/]+\/mandate/.test(pathname)) {
    return copy.mutualFunds.sipMandateTitle;
  }

  const holdingId = extractPortfolioHoldingId(pathname);
  if (holdingId) {
    return copy.dashboard.portfolio.holdingsTitle;
  }

  if (pathname === "/dashboard/portfolio") {
    const tab = parsePortfolioPageTab(searchParams?.get("tab"));
    return getPortfolioTabMeta(tab).pageTitle;
  }

  if (pathname === "/dashboard/mutual-funds/all") {
    if (searchParams?.get("category")) {
      return "Browse funds";
    }
  }

  if (pathname === "/dashboard/family/group") {
    return copy.familyGroups.dashboard.viewGroupAction;
  }

  if (pathname.startsWith("/dashboard/family/activity")) {
    return copy.familyGroups.activity.pageTitle;
  }

  if (pathname.startsWith("/dashboard/family/invites")) {
    return copy.familyGroups.invite.pendingPageTitle;
  }

  if (pathname === "/dashboard/mutual-funds/cart") {
    return copy.mutualFunds.cartTitle;
  }

  if (pathname === "/dashboard/mutual-funds/all" && searchParams?.get("category")) {
    return "Browse funds";
  }

  return getDashboardPageMeta(pathname).title;
}
