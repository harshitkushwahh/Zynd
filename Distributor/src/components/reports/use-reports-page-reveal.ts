"use client";

import { useEffect, useState } from "react";

/** Minimum skeleton time so the reports page open feels smooth, not flickery. */
export const DISTRIBUTOR_REPORTS_PAGE_ENTER_MIN_MS = 320;

type UseReportsPageRevealOptions = {
  /** When false (e.g. auth hydrating), keep skeleton visible. */
  ready?: boolean;
};

export function useReportsPageReveal({ ready = true }: UseReportsPageRevealOptions = {}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ready) {
      setRevealed(false);
      return;
    }

    const id = window.setTimeout(() => {
      setRevealed(true);
    }, DISTRIBUTOR_REPORTS_PAGE_ENTER_MIN_MS);

    return () => window.clearTimeout(id);
  }, [ready]);

  const showSkeleton = !ready || !revealed;

  return { showSkeleton, revealed: ready && revealed };
}
