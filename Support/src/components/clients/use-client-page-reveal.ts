"use client";

import { useEffect, useState } from "react";

/** Minimum skeleton time so client pages feel smooth, not flickery. */
export const DISTRIBUTOR_CLIENT_PAGE_ENTER_MIN_MS = 320;

type UseClientPageRevealOptions = {
  /** When false (e.g. still fetching), keep skeleton visible. */
  ready: boolean;
  /** Changing this resets the reveal timer (e.g. client or family group id). */
  resetKey: string;
};

export function useClientPageReveal({ ready, resetKey }: UseClientPageRevealOptions) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [resetKey]);

  useEffect(() => {
    if (!ready) {
      setRevealed(false);
      return;
    }

    const id = window.setTimeout(() => {
      setRevealed(true);
    }, DISTRIBUTOR_CLIENT_PAGE_ENTER_MIN_MS);

    return () => window.clearTimeout(id);
  }, [ready, resetKey]);

  const showSkeleton = !ready || !revealed;

  return { showSkeleton, revealed: ready && revealed };
}
