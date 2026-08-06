import {
  Building2,
  CalendarDays,
  ClipboardList,
  Crown,
  IndianRupee,
  LayoutDashboard,
  Network,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";

export type DistributorHeadTabId =
  | "overview"
  | "state-heads"
  | "queue"
  | "managers"
  | "leave"
  | "distributors"
  | "branches"
  | "sales";

export const DISTRIBUTOR_HEAD_TAB_IDS = [
  "overview",
  "state-heads",
  "queue",
  "managers",
  "leave",
  "distributors",
  "branches",
  "sales",
] as const satisfies readonly DistributorHeadTabId[];

export const DISTRIBUTOR_HEAD_QUEUE_PERMISSION = "admin.distributor_partners.list";
export const DISTRIBUTOR_HEAD_QUEUE_APPROVE_PERMISSION = "admin.distributor_partners.approve";
export const DISTRIBUTOR_HEAD_HIERARCHY_READ_PERMISSION = "admin.distributor_hierarchy.read";
export const DISTRIBUTOR_HEAD_BRANCHES_LIST_PERMISSION = "admin.distributor_branches.list";
export const DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION = "admin.distributor_branches.manage";
export const DISTRIBUTOR_HEAD_MANAGERS_LIST_PERMISSION = "admin.distributor_managers.list";

export const DISTRIBUTOR_HEAD_HIERARCHY_PERMISSIONS = [
  DISTRIBUTOR_HEAD_HIERARCHY_READ_PERMISSION,
  DISTRIBUTOR_HEAD_BRANCHES_LIST_PERMISSION,
  DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION,
  DISTRIBUTOR_HEAD_MANAGERS_LIST_PERMISSION,
] as const;

export type DistributorHeadTab = {
  id: DistributorHeadTabId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const DISTRIBUTOR_HEAD_TABS: DistributorHeadTab[] = [
  {
    id: "overview",
    label: "Overview",
    description: "State-wide hierarchy snapshot and headline metrics.",
    icon: LayoutDashboard,
  },
  {
    id: "state-heads",
    label: `${MITRA_HIERARCHY_COPY.stateHead}s`,
    description: `${MITRA_HIERARCHY_COPY.stateHead} accounts scoped to a single state.`,
    icon: Crown,
  },
  {
    id: "queue",
    label: "Queue",
    description: "Zynd Mitra applications awaiting HO review.",
    icon: ClipboardList,
  },
  {
    id: "managers",
    label: MITRA_HIERARCHY_COPY.branchManagers,
    description: `${MITRA_HIERARCHY_COPY.branchManagers} reporting to the ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()}.`,
    icon: Users2,
  },
  {
    id: "leave",
    label: "Leave",
    description: `${MITRA_HIERARCHY_COPY.branchManager} leave applications in your state.`,
    icon: CalendarDays,
  },
  {
    id: "distributors",
    label: MITRA_HIERARCHY_COPY.zyndMitras,
    description: `All ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} under branch managers in this state.`,
    icon: Network,
  },
  {
    id: "branches",
    label: "Branches",
    description: "Branches and cities covered in the state.",
    icon: Building2,
  },
  {
    id: "sales",
    label: "Sales",
    description: "Aggregated sales across the state network.",
    icon: IndianRupee,
  },
];

export function resolveDistributorHeadTab(tabSlug?: string): DistributorHeadTab {
  const match = DISTRIBUTOR_HEAD_TABS.find((tab) => tab.id === tabSlug);
  return match ?? DISTRIBUTOR_HEAD_TABS[0];
}

export function distributorHeadTabHref(tab: DistributorHeadTab) {
  return tab.id === "overview"
    ? "/dashboard/distributor-head"
    : `/dashboard/distributor-head/${tab.id}`;
}
