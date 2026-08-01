import type { DistributorPageIconName } from "@/components/dashboard/distributor-page-icons";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export type DistributorPageConfig = {
  iconName: DistributorPageIconName;
  title: string;
  description: string;
};

export const DISTRIBUTOR_PAGE_CONFIG = {
  yourClients: {
    iconName: "users",
    title: "Your clients",
    description: "",
  },
  yourClientsTable: {
    iconName: "users",
    title: "Your clients",
    description: ZYND_MITRA_COPY.yourBookArn,
  },
  yourOperations: {
    iconName: "layers3",
    title: "Your operations",
    description: "",
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
    description: ZYND_MITRA_COPY.txnAwaitingMitra,
  },
  allInvestors: {
    iconName: "users",
    title: "All Investors",
    description: ZYND_MITRA_COPY.fullBookDesc,
  },
  residentInvestors: {
    iconName: "users",
    title: "All investors",
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
    description: "",
  },
  settings: {
    iconName: "settings",
    title: "Settings",
    description: "",
  },
  branchDistributors: {
    iconName: "users2",
    title: ZYND_MITRA_COPY.plural,
    description: "",
  },
  payouts: {
    iconName: "wallet",
    title: "My work",
    description: "",
  },
  payrollDetail: {
    iconName: "wallet",
    title: "Payroll history",
    description: "",
  },
  leaveDetail: {
    iconName: "wallet",
    title: "Leave history",
    description: "",
  },
  attendanceDetail: {
    iconName: "wallet",
    title: "Work attendance",
    description: "",
  },
  compliance: {
    iconName: "clipboardCheck",
    title: "Compliance",
    description: "",
  },
  leads: {
    iconName: "userRoundPlus",
    title: "Leads",
    description: "",
  },
  reports: {
    iconName: "fileSpreadsheet",
    title: "Reports",
    description: "",
  },
  branchCommissions: {
    iconName: "indianRupee",
    title: "Incentives",
    description: "Branch incentive accrual, holds, and payout roll-up.",
  },
  branchReports: {
    iconName: "fileText",
    title: "Reports",
    description: "Branch AUM, sales, and compliance exports.",
  },
  branchPerformance: {
    iconName: "barChart3",
    title: "Team performance",
    description: ZYND_MITRA_COPY.targetsPerMitra,
  },
} as const satisfies Record<string, DistributorPageConfig>;

export type DistributorPageConfigKey = keyof typeof DISTRIBUTOR_PAGE_CONFIG;
