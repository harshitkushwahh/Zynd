import type { DistributorPageIconName } from "@/components/dashboard/distributor-page-icons";

export type DistributorPageConfig = {
  iconName: DistributorPageIconName;
  title: string;
  description: string;
};

export const DISTRIBUTOR_PAGE_CONFIG = {
  dashboard: {
    iconName: "layoutDashboard",
    title: "Dashboard",
    description: "Snapshot of your demo investor book and operations activity.",
  },
  yourClients: {
    iconName: "users",
    title: "Your clients",
    description: "Investors you onboarded or added to your book — not the full platform directory.",
  },
  yourClientsTable: {
    iconName: "users",
    title: "Your clients",
    description: "Only clients linked to your distributor ARN (demo).",
  },
  yourOperations: {
    iconName: "layers3",
    title: "Your operations",
    description: "Overview of orders, plans, approvals, and transaction groups.",
  },
  orders: {
    iconName: "layers3",
    title: "Orders",
    description: "Lumpsum, redeem, and switch order activity (dummy data).",
  },
  systematicPlans: {
    iconName: "calendarClock",
    title: "Systematic Plans",
    description: "SIP, STP, and SWP plan book (dummy data).",
  },
  txnRequests: {
    iconName: "arrowLeftRight",
    title: "Txn Requests",
    description: "Pending and recent transaction requests awaiting distributor action.",
  },
  allInvestors: {
    iconName: "users",
    title: "All Investors",
    description:
      "Full investor book for this distributor — onboarding, compliance, and investment status at a glance.",
  },
  residentInvestors: {
    iconName: "users",
    title: "Residential",
    description: "All resident individuals on Zynd — PM and DIY users across the platform (demo).",
  },
  nriInvestors: {
    iconName: "users",
    title: "Non Resident Individual",
    description: "Non-resident individual investors only.",
  },
  transactionGroups: {
    iconName: "folderKanban",
    title: "Transaction Groups",
    description: "Grouped multi-leg transactions for batch processing (dummy data).",
  },
  notifications: {
    iconName: "bell",
    title: "Notifications",
    description: "Alerts for transaction requests, investors, orders, and systematic plans.",
  },
  settings: {
    iconName: "settings",
    title: "Settings",
    description: "Account details and console preferences for this distributor workspace.",
  },
  branchDistributors: {
    iconName: "users2",
    title: "Distributors",
    description: "Distributors mapped to your branch.",
  },
  branchCommissions: {
    iconName: "indianRupee",
    title: "Commissions",
    description: "Commission accruals, holds, and payout history.",
  },
  branchReports: {
    iconName: "fileText",
    title: "Reports",
    description: "Branch AUM, sales, and compliance exports.",
  },
  branchPerformance: {
    iconName: "barChart3",
    title: "Team performance",
    description: "Targets vs actuals for each distributor.",
  },
} as const satisfies Record<string, DistributorPageConfig>;

export type DistributorPageConfigKey = keyof typeof DISTRIBUTOR_PAGE_CONFIG;
