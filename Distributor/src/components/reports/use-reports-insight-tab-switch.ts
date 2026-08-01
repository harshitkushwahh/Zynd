"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { DISTRIBUTOR_REPORTS_PAGE_ENTER_MIN_MS } from "@/components/reports/use-reports-page-reveal";
import type { DistributorReportsInsightTabId } from "@/lib/distributor-reports-insight-tabs";

type UseReportsInsightTabSwitchOptions = {
  initialTab?: DistributorReportsInsightTabId;
};

export function useReportsInsightTabSwitch({
  initialTab = "book",
}: UseReportsInsightTabSwitchOptions = {}) {
  const [activeTab, setActiveTabState] = useState<DistributorReportsInsightTabId>(initialTab);
  const [showPanelSkeleton, setShowPanelSkeleton] = useState(false);
  const [isPending, startTransition] = useTransition();
  const switchStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showPanelSkeleton) return;

    const started = switchStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, DISTRIBUTOR_REPORTS_PAGE_ENTER_MIN_MS - elapsed);

    const id = window.setTimeout(() => {
      setShowPanelSkeleton(false);
      switchStartedAtRef.current = null;
    }, remaining);

    return () => window.clearTimeout(id);
  }, [activeTab, showPanelSkeleton]);

  const setActiveTab = useCallback(
    (tab: DistributorReportsInsightTabId) => {
      if (tab === activeTab && !showPanelSkeleton) return;

      switchStartedAtRef.current = Date.now();
      setShowPanelSkeleton(true);

      startTransition(() => {
        setActiveTabState(tab);
      });
    },
    [activeTab, showPanelSkeleton],
  );

  const isSwitching = showPanelSkeleton || isPending;

  return {
    activeTab,
    setActiveTab,
    isSwitching,
    showPanelSkeleton,
  };
}
