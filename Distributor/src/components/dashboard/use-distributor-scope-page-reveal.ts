"use client";

import { useEffect, useState } from "react";

/** Minimum skeleton time so scope pages feel smooth, not flickery. */
export const DISTRIBUTOR_SCOPE_PAGE_ENTER_MIN_MS = 320;

type UseDistributorScopePageRevealOptions = {
  /** When false (e.g. auth hydrating), keep skeleton visible. */
  ready?: boolean;
};

export function useDistributorScopePageReveal({
  ready = true,
}: UseDistributorScopePageRevealOptions = {}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ready) {
      setRevealed(false);
      return;
    }

    const id = window.setTimeout(() => {
      setRevealed(true);
    }, DISTRIBUTOR_SCOPE_PAGE_ENTER_MIN_MS);

    return () => window.clearTimeout(id);
  }, [ready]);

  const showSkeleton = !ready || !revealed;

  return { showSkeleton, revealed: ready && revealed };
}
