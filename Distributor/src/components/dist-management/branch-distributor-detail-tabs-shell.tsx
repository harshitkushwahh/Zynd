"use client";

import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  CalendarClock,
  LayoutGrid,
  PieChart,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  DISTRIBUTOR_TABS_CONTENT_CLASS,
  DISTRIBUTOR_TABS_ROOT_CLASS,
} from "@/lib/distributor-layout";

export const BRANCH_DISTRIBUTOR_TAB_IDS = [
  "overview",
  "portfolio",
  "clients",
  "transactions",
  "sips",
] as const;

export type BranchDistributorTabId = (typeof BRANCH_DISTRIBUTOR_TAB_IDS)[number];

const TAB_LABELS: Record<BranchDistributorTabId, string> = {
  overview: "Overview",
  portfolio: "Book portfolio",
  clients: "Clients",
  transactions: "Transactions",
  sips: "SIPs & STPs",
};

const TAB_ICONS: Record<BranchDistributorTabId, LucideIcon> = {
  overview: LayoutGrid,
  portfolio: PieChart,
  clients: Users,
  transactions: ArrowLeftRight,
  sips: CalendarClock,
};

type BranchDistributorDetailTabsShellProps = {
  defaultTab?: BranchDistributorTabId;
  panels: Record<BranchDistributorTabId, ReactNode>;
};

export function BranchDistributorDetailTabsShell({
  defaultTab = "overview",
  panels,
}: BranchDistributorDetailTabsShellProps) {
  return (
    <Tabs defaultValue={defaultTab} className={DISTRIBUTOR_TABS_ROOT_CLASS}>
      <div className="border-b border-border">
        <TabsList
          variant="line"
          aria-label="Distributor profile sections"
          className={cn(
            "h-auto w-full min-w-0 justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0",
            "[&::-webkit-scrollbar]:h-1",
          )}
        >
          {BRANCH_DISTRIBUTOR_TAB_IDS.map((tabId) => {
            const Icon = TAB_ICONS[tabId];
            return (
              <TabsTrigger
                key={tabId}
                value={tabId}
                className="shrink-0 gap-1.5 rounded-none px-3 py-2.5 text-caption after:bottom-0 data-active:text-foreground"
              >
                <Icon className="size-3.5 opacity-80" aria-hidden />
                {TAB_LABELS[tabId]}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {BRANCH_DISTRIBUTOR_TAB_IDS.map((tabId) => (
        <TabsContent key={tabId} value={tabId} className={DISTRIBUTOR_TABS_CONTENT_CLASS}>
          {panels[tabId]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
