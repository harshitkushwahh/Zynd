import {
  ArrowLeftRight,
  Banknote,
  CalendarClock,
  LayoutGrid,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { PortfolioPageTab } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import { PORTFOLIO_PAGE_TAB_IDS } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import { copy } from "@/shared/config/copy";

export type PortfolioTabMeta = {
  id: PortfolioPageTab;
  tabLabel: string;
  pageTitle: string;
  breadcrumbLabel: string;
  icon: LucideIcon;
};

function portfolioPageTitle(baseTitle: string, tabLabel: string) {
  return `${baseTitle} / ${tabLabel}`;
}

function buildPortfolioTabMeta(): Record<PortfolioPageTab, PortfolioTabMeta> {
  const portfolioCopy = copy.dashboard.portfolio;
  const baseTitle = portfolioCopy.pageTitle;

  return {
    overview: {
      id: "overview",
      tabLabel: portfolioCopy.tabOverview,
      pageTitle: baseTitle,
      breadcrumbLabel: baseTitle,
      icon: LayoutGrid,
    },
    sips: {
      id: "sips",
      tabLabel: portfolioCopy.tabSips,
      pageTitle: portfolioPageTitle(baseTitle, portfolioCopy.tabSips),
      breadcrumbLabel: portfolioCopy.tabSips,
      icon: CalendarClock,
    },
    "redeem-units": {
      id: "redeem-units",
      tabLabel: portfolioCopy.tabRedeemUnits,
      pageTitle: portfolioPageTitle(baseTitle, portfolioCopy.tabRedeemUnits),
      breadcrumbLabel: portfolioCopy.tabRedeemUnits,
      icon: Banknote,
    },
    transactions: {
      id: "transactions",
      tabLabel: portfolioCopy.tabTransactions,
      pageTitle: portfolioPageTitle(baseTitle, portfolioCopy.tabTransactions),
      breadcrumbLabel: portfolioCopy.tabTransactions,
      icon: ArrowLeftRight,
    },
  };
}

export const PORTFOLIO_TAB_META = buildPortfolioTabMeta();

export const PORTFOLIO_TAB_LIST = PORTFOLIO_PAGE_TAB_IDS.map((id) => PORTFOLIO_TAB_META[id]);

export function getPortfolioTabMeta(tab: PortfolioPageTab): PortfolioTabMeta {
  return PORTFOLIO_TAB_META[tab];
}

export const PORTFOLIO_PAGE_ICON = Wallet;
