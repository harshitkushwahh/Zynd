import {
  ArrowDownToLine,
  ArrowLeftRight,
  CalendarClock,
  IndianRupee,
  Layers,
  Pencil,
  Repeat,
  ShoppingBag,
  Shuffle,
  Wallet,
  Webhook,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type AdminSectionTab = {
  slug: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** When false, tab is visible but not navigable. Defaults to true. */
  enabled?: boolean;
};

export type AdminTransactionSection = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  permissions: string[];
  tabs: AdminSectionTab[];
};

export const ADMIN_TRANSACTION_SECTIONS: Record<string, AdminTransactionSection> = {
  orders: {
    id: "orders",
    label: "Orders",
    href: "/dashboard/orders",
    icon: ShoppingBag,
    description: "Purchases, SIP installments, redemptions, switches, and webhooks",
    permissions: ["mf.transactions.read"],
    tabs: [
      {
        slug: "purchases",
        label: "Purchases",
        icon: ShoppingBag,
        description: "Lumpsum and one-time purchase orders",
      },
      {
        slug: "sip-installments",
        label: "SIP Installments",
        icon: CalendarClock,
        description: "Recurring SIP installment orders and payment status",
      },
      {
        slug: "redemptions",
        label: "Redemptions",
        icon: ArrowDownToLine,
        description: "Redemption orders and payout tracking",
        enabled: false,
      },
      {
        slug: "switches",
        label: "Switches",
        icon: ArrowLeftRight,
        description: "Switch orders between schemes",
        enabled: false,
      },
      {
        slug: "webhooks",
        label: "Webhooks",
        icon: Webhook,
        description: "Webhook events, replay, and processing status",
        enabled: false,
      },
    ],
  },
  "systematic-plans": {
    id: "systematic-plans",
    label: "Systematic Plans",
    href: "/dashboard/systematic-plans",
    icon: Repeat,
    description: "SIPs, STPs, and SWPs across investor portfolios",
    permissions: ["mf.transactions.read"],
    tabs: [
      {
        slug: "sips",
        label: "SIPs",
        icon: Repeat,
        description: "Active systematic investment plans",
      },
      {
        slug: "stps",
        label: "STPs",
        icon: Shuffle,
        description: "Systematic transfer plans between schemes",
        enabled: false,
      },
      {
        slug: "swps",
        label: "SWPs",
        icon: Wallet,
        description: "Systematic withdrawal plans and schedules",
        enabled: false,
      },
    ],
  },
  "txn-requests": {
    id: "txn-requests",
    label: "Txn Requests",
    href: "/dashboard/txn-requests",
    icon: Layers,
    description: "Lumpsum, SIP, redemption, and switch transaction requests",
    permissions: ["mf.transactions.read"],
    tabs: [
      {
        slug: "lumpsum",
        label: "Lumpsum",
        icon: IndianRupee,
        description: "Lumpsum transaction requests and approvals",
      },
      {
        slug: "sip",
        label: "SIP",
        icon: Repeat,
        description: "SIP creation and registration requests",
      },
      {
        slug: "cancel-sip",
        label: "Cancel SIP",
        icon: XCircle,
        description: "SIP cancellation requests",
        enabled: false,
      },
      {
        slug: "modify-sip",
        label: "Modify SIP",
        icon: Pencil,
        description: "SIP modification requests",
        enabled: false,
      },
      {
        slug: "redemption",
        label: "Redemption",
        icon: ArrowDownToLine,
        description: "Redemption transaction requests",
      },
      {
        slug: "switch",
        label: "Switch",
        icon: ArrowLeftRight,
        description: "Switch transaction requests",
        enabled: false,
      },
    ],
  },
};

export function getTransactionSection(sectionId: string) {
  return ADMIN_TRANSACTION_SECTIONS[sectionId] ?? null;
}

export function getDefaultSectionTab(section: AdminTransactionSection) {
  return section.tabs.find((tab) => tab.enabled !== false) ?? section.tabs[0] ?? null;
}

export function isSectionTabEnabled(tab: AdminSectionTab) {
  return tab.enabled !== false;
}

export function resolveSectionTab(section: AdminTransactionSection, tabSlug?: string) {
  if (!tabSlug) return getDefaultSectionTab(section);
  return section.tabs.find((tab) => tab.slug === tabSlug) ?? getDefaultSectionTab(section);
}

export function sectionTabHref(section: AdminTransactionSection, tab: AdminSectionTab) {
  return `${section.href}/${tab.slug}`;
}
