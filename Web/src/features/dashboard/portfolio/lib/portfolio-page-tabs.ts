export type PortfolioPageTab = "overview" | "sips" | "redeem-units" | "transactions";

export const PORTFOLIO_PAGE_TAB_IDS: readonly PortfolioPageTab[] = [
  "overview",
  "sips",
  "redeem-units",
  "transactions",
] as const;

export const PORTFOLIO_PAGE_HREF = "/dashboard/portfolio";

export function parsePortfolioPageTab(value: string | null | undefined): PortfolioPageTab {
  if (value && (PORTFOLIO_PAGE_TAB_IDS as readonly string[]).includes(value)) {
    return value as PortfolioPageTab;
  }
  return "overview";
}

export function portfolioTabHref(tab: PortfolioPageTab) {
  if (tab === "overview") return PORTFOLIO_PAGE_HREF;
  return `${PORTFOLIO_PAGE_HREF}?tab=${tab}`;
}
