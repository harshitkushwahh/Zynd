"use client";

import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  CalendarClock,
  ClipboardCheck,
  Goal,
  PieChart,
  ShieldHalf,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { cn } from "@/lib/utils";
import {
  DISTRIBUTOR_TABS_CONTENT_CLASS,
  DISTRIBUTOR_TABS_ROOT_CLASS,
} from "@/lib/distributor-layout";

export const CLIENT_DETAIL_TAB_IDS = [
  "portfolio",
  "personal",
  "kyc",
  "risk",
  "goals",
  "family",
  "transactions",
  "sips",
] as const;

export type ClientDetailTabId = (typeof CLIENT_DETAIL_TAB_IDS)[number];

const TAB_ICONS: Record<ClientDetailTabId, LucideIcon> = {
  portfolio: PieChart,
  personal: UserRound,
  kyc: ClipboardCheck,
  risk: ShieldHalf,
  goals: Goal,
  family: Users,
  transactions: ArrowLeftRight,
  sips: CalendarClock,
};

type ClientDetailTabsShellProps = {
  defaultTab?: ClientDetailTabId;
  panels: Record<ClientDetailTabId, ReactNode>;
};

export function ClientDetailTabsShell({
  defaultTab = "portfolio",
  panels,
}: ClientDetailTabsShellProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.tabs;

  return (
    <Tabs defaultValue={defaultTab} className={DISTRIBUTOR_TABS_ROOT_CLASS}>
      <div className="border-b border-border">
        <TabsList
          variant="line"
          aria-label={copy.ariaLabel}
          className={cn(
            "h-auto w-full min-w-0 justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0",
            "[&::-webkit-scrollbar]:h-1",
          )}
        >
          {CLIENT_DETAIL_TAB_IDS.map((tabId) => {
            const Icon = TAB_ICONS[tabId];
            const label = copy[tabId];
            return (
              <TabsTrigger
                key={tabId}
                value={tabId}
                className="shrink-0 gap-1.5 rounded-none px-3 py-2.5 text-caption after:bottom-0 data-active:text-foreground"
              >
                <Icon className="size-3.5 opacity-80" aria-hidden />
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {CLIENT_DETAIL_TAB_IDS.map((tabId) => (
        <TabsContent key={tabId} value={tabId} className={DISTRIBUTOR_TABS_CONTENT_CLASS}>
          {panels[tabId]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
