"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Keeps previously visited tab panels mounted so their state and data survive tab switches.
 */
export function useMountedTabs<T extends string>(initialTab: T, urlTab?: T) {
  const resolvedInitial = urlTab ?? initialTab;
  const [activeTab, setActiveTab] = useState<T>(resolvedInitial);
  const [mountedTabs, setMountedTabs] = useState<Set<T>>(() => new Set([resolvedInitial]));

  useEffect(() => {
    if (!urlTab) return;
    setActiveTab(urlTab);
    setMountedTabs((current) => {
      if (current.has(urlTab)) return current;
      return new Set(current).add(urlTab);
    });
  }, [urlTab]);

  const selectTab = useCallback((tab: T) => {
    setActiveTab(tab);
    setMountedTabs((current) => new Set(current).add(tab));
  }, []);

  const keepMounted = useCallback((tab: T) => mountedTabs.has(tab), [mountedTabs]);

  return { activeTab, selectTab, keepMounted };
}
