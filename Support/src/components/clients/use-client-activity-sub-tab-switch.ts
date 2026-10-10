"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { ClientActivitySubTabId } from "@/components/clients/client-activity-sub-tab-ids";
import { DISTRIBUTOR_CLIENT_PAGE_ENTER_MIN_MS } from "@/components/clients/use-client-page-reveal";

type UseClientActivitySubTabSwitchOptions = {
  initialTab?: ClientActivitySubTabId;
};

export function useClientActivitySubTabSwitch({
  initialTab = "sips",
}: UseClientActivitySubTabSwitchOptions = {}) {
  const [activeSubTab, setActiveSubTabState] = useState<ClientActivitySubTabId>(initialTab);
  const [showPanelSkeleton, setShowPanelSkeleton] = useState(false);
  const [isPending, startTransition] = useTransition();
  const switchStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showPanelSkeleton) return;

    const started = switchStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, DISTRIBUTOR_CLIENT_PAGE_ENTER_MIN_MS - elapsed);

    const id = window.setTimeout(() => {
      setShowPanelSkeleton(false);
      switchStartedAtRef.current = null;
    }, remaining);

    return () => window.clearTimeout(id);
  }, [activeSubTab, showPanelSkeleton]);

  const setActiveSubTab = useCallback(
    (tab: ClientActivitySubTabId) => {
      if (tab === activeSubTab && !showPanelSkeleton) return;

      switchStartedAtRef.current = Date.now();
      setShowPanelSkeleton(true);

      startTransition(() => {
        setActiveSubTabState(tab);
      });
    },
    [activeSubTab, showPanelSkeleton],
  );

  const isSwitching = showPanelSkeleton || isPending;

  return {
    activeSubTab,
    setActiveSubTab,
    isSwitching,
    showPanelSkeleton,
  };
}
