/** Popular tools in the MF dashboard sidebar. */
export type MfPopularTool = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: "cas" | "screener" | "compare" | "lumpsum-calc" | "sip-calc";
  disabled?: boolean;
};

export const MF_POPULAR_TOOLS: MfPopularTool[] = [
  {
    id: "compare",
    label: "Compare funds",
    description: "Side-by-side up to 3 schemes",
    href: "/dashboard/mutual-funds/compare",
    icon: "compare",
  },
  {
    id: "lumpsum-calc",
    label: "Lumpsum calculator",
    description: "Project one-time investment growth",
    href: "/dashboard/mutual-funds/calculators/lumpsum",
    icon: "lumpsum-calc",
  },
  {
    id: "sip-calc",
    label: "SIP calculator",
    description: "Estimate monthly SIP returns",
    href: "/dashboard/mutual-funds/calculators/sip",
    icon: "sip-calc",
  },
  {
    id: "all-funds",
    label: "Fund screener",
    description: "Filter and browse all funds",
    href: "/dashboard/mutual-funds/all",
    icon: "screener",
  },
  {
    id: "cas-import",
    label: "Import CAS",
    description: "Sync external MF holdings",
    href: "/dashboard/mutual-funds",
    icon: "cas",
    disabled: true,
  },
];

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
