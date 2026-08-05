"use client";

import { useEffect, useState } from "react";

/** Minimum skeleton time so the quick transaction page open feels smooth. */
export const QUICK_TXN_PAGE_ENTER_MIN_MS = 320;

type UseQuickTransactionPageRevealOptions = {
  ready?: boolean;
};

export function useQuickTransactionPageReveal({ ready = true }: UseQuickTransactionPageRevealOptions = {}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ready) {
      setRevealed(false);
      return;
    }

    const id = window.setTimeout(() => {
      setRevealed(true);
    }, QUICK_TXN_PAGE_ENTER_MIN_MS);

    return () => window.clearTimeout(id);
  }, [ready]);

  return {
    showSkeleton: !ready || !revealed,
    revealed: ready && revealed,
  };
}
