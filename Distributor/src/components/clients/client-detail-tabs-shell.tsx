"use client";

import type { ReactNode } from "react";
import { useCallback, useLayoutEffect, useRef, useState, useTransition } from "react";

import { ClientDetailSectionTabs } from "@/components/clients/client-detail-section-tabs";
import { ClientDetailTabNavigationProvider } from "@/components/clients/client-detail-tab-navigation";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import type { ClientDetailTabId } from "@/components/clients/client-detail-tab-ids";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  DISTRIBUTOR_CLIENT_DETAIL_TABS_ASIDE_CLASS,
  DISTRIBUTOR_CLIENT_DETAIL_TABS_BODY_CLASS,
  DISTRIBUTOR_CLIENT_DETAIL_TABS_MAIN_CLASS,
  DISTRIBUTOR_TABS_CONTENT_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

export { CLIENT_DETAIL_TAB_IDS, type ClientDetailTabId } from "@/components/clients/client-detail-tab-ids";

type ClientDetailTabsShellProps = {
  defaultTab?: ClientDetailTabId;
  panels: Record<ClientDetailTabId, ReactNode>;
  aside: ReactNode;
};

function getMainScrollElement(node: HTMLElement | null): HTMLElement | null {
  return node?.closest(".distributor-main-scroll") ?? null;
}

export function ClientDetailTabsShell({
  defaultTab = "portfolio",
  panels,
  aside,
}: ClientDetailTabsShellProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.tabs;
  const resolvedDefaultTab = defaultTab ?? "portfolio";
  const [activeTab, setActiveTab] = useState<ClientDetailTabId>(resolvedDefaultTab);
  const [isTabPending, startTabTransition] = useTransition();
  const tabsBodyRef = useRef<HTMLDivElement>(null);
  const bodyViewportTopRef = useRef<number | null>(null);

  const onTabChange = useCallback((value: ClientDetailTabId) => {
    const body = tabsBodyRef.current;
    if (body) {
      bodyViewportTopRef.current = body.getBoundingClientRect().top;
    }
    startTabTransition(() => {
      setActiveTab(value);
    });
  }, []);

  useLayoutEffect(() => {
    const anchorTop = bodyViewportTopRef.current;
    if (anchorTop == null) {
      return;
    }

    const body = tabsBodyRef.current;
    const scrollParent = getMainScrollElement(body);
    if (!body || !scrollParent) {
      bodyViewportTopRef.current = null;
      return;
    }

    const nextTop = body.getBoundingClientRect().top;
    const delta = nextTop - anchorTop;
    if (Math.abs(delta) > 0.5) {
      scrollParent.scrollTop += delta;
    }
    bodyViewportTopRef.current = null;
  }, [activeTab]);

  return (
    <ClientDetailTabNavigationProvider navigateToTab={onTabChange}>
      <div className={cn("distributor-client-detail-tabs-root")}>
      <DistributorPageHeader
        title={copy[activeTab]}
        titleAs="h2"
        titleSwitchKey={activeTab}
        titleClassName="distributor-client-detail-tab-panel__title"
        className="distributor-client-detail-tabs-header"
      >
        <ClientDetailSectionTabs
          value={activeTab}
          onChange={onTabChange}
          busy={isTabPending}
        />
      </DistributorPageHeader>

      <div ref={tabsBodyRef} className={DISTRIBUTOR_CLIENT_DETAIL_TABS_BODY_CLASS}>
        <div className={DISTRIBUTOR_CLIENT_DETAIL_TABS_MAIN_CLASS}>
          <div
            key={activeTab}
            role="tabpanel"
            aria-labelledby={`client-detail-tab-${activeTab}`}
            id={`client-detail-panel-${activeTab}`}
            tabIndex={0}
            className={cn(
              DISTRIBUTOR_TABS_CONTENT_CLASS,
              "distributor-client-detail-tab-panel",
              isTabPending && "distributor-client-detail-tab-panel--pending",
            )}
          >
            {panels[activeTab]}
          </div>
        </div>
        <aside className={DISTRIBUTOR_CLIENT_DETAIL_TABS_ASIDE_CLASS}>{aside}</aside>
      </div>
      </div>
    </ClientDetailTabNavigationProvider>
  );
}
