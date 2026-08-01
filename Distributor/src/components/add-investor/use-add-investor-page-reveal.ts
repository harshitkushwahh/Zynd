"use client";

import { useEffect, useState } from "react";

/** Minimum skeleton time so the add investor page open feels smooth. */
export const ADD_INVESTOR_PAGE_ENTER_MIN_MS = 320;

type UseAddInvestorPageRevealOptions = {
  ready?: boolean;
};

export function useAddInvestorPageReveal({ ready = true }: UseAddInvestorPageRevealOptions = {}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ready) {
      setRevealed(false);
      return;
    }

    const id = window.setTimeout(() => {
      setRevealed(true);
    }, ADD_INVESTOR_PAGE_ENTER_MIN_MS);

    return () => window.clearTimeout(id);
  }, [ready]);

  return {
    showSkeleton: !ready || !revealed,
    revealed: ready && revealed,
  };
}
