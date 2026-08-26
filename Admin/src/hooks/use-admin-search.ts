"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { searchAdmin, type AdminSearchResult, type AdminSearchScope } from "@/lib/admin-search-api";
import { getErrorMessage } from "@/lib/errors";

type UseAdminSearchOptions = {
  scope: AdminSearchScope;
  query: string;
  limit?: number;
  offset?: number;
  stage?: string;
  status?: string;
  period?: string;
  enabled?: boolean;
  debounceMs?: number;
};

export function useAdminSearch<T = Record<string, unknown>>({
  scope,
  query,
  limit = 50,
  offset = 0,
  stage,
  status,
  period,
  enabled = true,
  debounceMs = 300,
}: UseAdminSearchOptions) {
  const [data, setData] = useState<AdminSearchResult<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!enabled) return null;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await searchAdmin<T>({
        scope,
        q: query,
        limit,
        offset,
        stage,
        status,
        period,
      });
      if (requestId === requestIdRef.current) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setData(null);
        setError(getErrorMessage(err, "Search failed."));
      }
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, limit, offset, period, query, scope, stage, status]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      void refetch();
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, enabled, refetch]);

  return {
    data,
    items: data?.items ?? [],
    total: data?.total ?? 0,
    cached: data?.cached ?? false,
    tookMs: data?.took_ms ?? 0,
    loading,
    error,
    refetch,
    setError,
  };
}
