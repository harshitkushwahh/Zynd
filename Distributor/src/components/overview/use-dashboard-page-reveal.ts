"use client";

import { useEffect, useState } from "react";

/** Minimum skeleton time so the dashboard open feels smooth, not flickery. */
export const DISTRIBUTOR_DASHBOARD_ENTER_MIN_MS = 320;

type UseDashboardPageRevealOptions = {
  /** When false (e.g. auth hydrating), keep skeleton visible. */
  ready?: boolean;
};

export function useDashboardPageReveal({ ready = true }: UseDashboardPageRevealOptions = {}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ready) {
      setRevealed(false);
      return;
    }

    const id = window.setTimeout(() => {
      setRevealed(true);
    }, DISTRIBUTOR_DASHBOARD_ENTER_MIN_MS);

    return () => window.clearTimeout(id);
  }, [ready]);

  const showSkeleton = !ready || !revealed;

  return { showSkeleton, revealed: ready && revealed };
}
