/** Popular tools in the MF dashboard sidebar. */
import type { LucideIcon } from "lucide-react";
import { CalendarClock, FileInput, GitCompare, LineChart, Search } from "lucide-react";

export type MfPopularTool = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: "cas" | "screener" | "compare" | "lumpsum-calc" | "sip-calc";
  disabled?: boolean;
};

export const MF_TOOL_ICONS: Record<MfPopularTool["icon"], LucideIcon> = {
  cas: FileInput,
  screener: Search,
  compare: GitCompare,
  "lumpsum-calc": LineChart,
  "sip-calc": CalendarClock,
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
    label: "One-time calculator",
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

/** Portfolio snapshot for the MF dashboard sidebar invested card. */
export type MfInvestedDayPoint = {
  label: string;
  value: number;
};

export type MfInvestedPreview = {
  totalValueInr: number;
  totalReturnPct: number;
  dayChangePct: number;
  dayChangePoints: MfInvestedDayPoint[];
};

/** Blurred placeholder for the MF sidebar invested card when the user has no holdings. */
export const MF_INVESTED_LOCKED_PREVIEW: MfInvestedPreview = {
  totalValueInr: 3_81_400,
  totalReturnPct: 12.4,
  dayChangePct: 0.8,
  dayChangePoints: [
    { label: "9:15 AM", value: 425_248 },
    { label: "10:00 AM", value: 425_620 },
    { label: "11:00 AM", value: 426_180 },
    { label: "12:00 PM", value: 425_940 },
    { label: "1:00 PM", value: 426_520 },
    { label: "2:00 PM", value: 427_110 },
    { label: "3:00 PM", value: 427_680 },
    { label: "3:30 PM", value: 428_650 },
  ],
};
