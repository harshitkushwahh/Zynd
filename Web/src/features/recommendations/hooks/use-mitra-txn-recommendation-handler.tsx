"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { MitraTxnRecommendationDialog } from "@/features/recommendations/components/mitra-txn-recommendation-dialog";

export const MITRA_RECOMMENDATION_QUERY_PARAM = "mitra_recommendation";

function clearMitraRecommendationQueryParam(router: ReturnType<typeof useRouter>) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete(MITRA_RECOMMENDATION_QUERY_PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  router.replace(next, { scroll: false });
}

function MitraTxnRecommendationHandlerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    const queryToken = searchParams.get(MITRA_RECOMMENDATION_QUERY_PARAM);
    if (!queryToken) return;
    if (handledRef.current === queryToken) return;

    handledRef.current = queryToken;
    setToken(queryToken);
    setOpen(true);
  }, [loading, searchParams, user]);

  return (
    <MitraTxnRecommendationDialog
      token={token}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setToken(null);
          handledRef.current = null;
          clearMitraRecommendationQueryParam(router);
        }
      }}
    />
  );
}

export function MitraTxnRecommendationHandler() {
  return (
    <Suspense fallback={null}>
      <MitraTxnRecommendationHandlerInner />
    </Suspense>
  );
}
