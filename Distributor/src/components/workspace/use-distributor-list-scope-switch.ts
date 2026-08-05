"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

/** Minimum time the table skeleton stays visible so the switch feels intentional, not flickery. */
export const DISTRIBUTOR_LIST_SCOPE_SWITCH_MIN_MS = 320;

type UseDistributorListScopeSwitchOptions<T extends string> = {
  urlScope: T;
  onNavigate: (scope: T) => void;
};

export function useDistributorListScopeSwitch<T extends string>({
  urlScope,
  onNavigate,
}: UseDistributorListScopeSwitchOptions<T>) {
  const [displayScope, setDisplayScope] = useState(urlScope);
  const [showTableSkeleton, setShowTableSkeleton] = useState(false);
  const [isPending, startTransition] = useTransition();
  const switchStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    setDisplayScope(urlScope);
  }, [urlScope]);

  useEffect(() => {
    if (!showTableSkeleton || displayScope !== urlScope) return;

    const started = switchStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, DISTRIBUTOR_LIST_SCOPE_SWITCH_MIN_MS - elapsed);

    const id = window.setTimeout(() => {
      setShowTableSkeleton(false);
      switchStartedAtRef.current = null;
    }, remaining);

    return () => window.clearTimeout(id);
  }, [showTableSkeleton, displayScope, urlScope]);

  const setListScope = useCallback(
    (scope: T) => {
      if (scope === displayScope && !showTableSkeleton && scope === urlScope) return;

      setDisplayScope(scope);
      setShowTableSkeleton(true);
      switchStartedAtRef.current = Date.now();

      startTransition(() => {
        onNavigate(scope);
      });
    },
    [displayScope, onNavigate, showTableSkeleton, urlScope],
  );

  const isSwitching = showTableSkeleton || isPending;

  return {
    displayScope,
    setListScope,
    isSwitching,
    showTableSkeleton,
  };
}
