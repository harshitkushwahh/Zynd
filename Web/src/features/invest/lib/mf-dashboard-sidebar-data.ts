/** Preview-only portfolio snapshot for the MF dashboard sidebar. */
export type MfInvestedPreview = {
  totalValueInr: number;
  totalReturnPct: number;
  dayChangePct: number;
};

export const MF_INVESTED_PREVIEW: MfInvestedPreview = {
  totalValueInr: 4_28_650,
  totalReturnPct: 12.4,
  dayChangePct: 0.8,
};

export type MfPopularTool = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: "cas" | "screener" | "high-return" | "best-sip";
};

export const MF_POPULAR_TOOLS: MfPopularTool[] = [
  {
    id: "cas-import",
    label: "Import CAS",
    description: "Sync external MF holdings",
    href: "/dashboard/mutual-funds",
    icon: "cas",
  },
  {
    id: "all-funds",
    label: "Fund screener",
    description: "Filter and compare all funds",
    href: "/dashboard/mutual-funds/all",
    icon: "screener",
  },
  {
    id: "high-return",
    label: "High return funds",
    description: "Top performers by returns",
    href: "/dashboard/mutual-funds/collections/high-return",
    icon: "high-return",
  },
  {
    id: "best-sip",
    label: "Best SIP picks",
    description: "SIP-friendly long-term funds",
    href: "/dashboard/mutual-funds/collections/best-sip",
    icon: "best-sip",
  },
];
