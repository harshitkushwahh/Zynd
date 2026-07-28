"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { invalidateInvestQueries } from "@/features/invest/lib/invalidate-invest-queries";

/** Invalidate invest list caches once when a payment/mandate flow reaches success. */
export function useInvestCacheInvalidation(sourceKey: string, shouldInvalidate: boolean) {
  const queryClient = useQueryClient();
  const invalidatedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldInvalidate) return;
    if (invalidatedForRef.current === sourceKey) return;
    invalidatedForRef.current = sourceKey;
    void invalidateInvestQueries(queryClient);
  }, [queryClient, shouldInvalidate, sourceKey]);
}
