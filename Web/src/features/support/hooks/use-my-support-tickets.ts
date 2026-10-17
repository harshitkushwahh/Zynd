"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listMySupportTicketsPage } from "@/features/support/lib/support-api";
import {
  connectSupportRealtime,
  type SupportRealtimeEvent,
} from "@/features/support/lib/support-realtime";
import {
  SUPPORT_TICKET_LIST_INITIAL,
  SUPPORT_TICKET_LIST_LOAD_MORE,
} from "@/features/support/lib/support-ticket-pagination";
import { patchSupportTicketListFromRealtime } from "@/features/support/lib/support-ticket-list-sync";
import type { SupportRecentTicket } from "@/features/support/lib/support-types";

export function useMySupportTickets() {
  const [tickets, setTickets] = useState<SupportRecentTicket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const refetchTimerRef = useRef<number | null>(null);
  const ticketsLengthRef = useRef(0);

  useEffect(() => {
    ticketsLengthRef.current = tickets.length;
  }, [tickets.length]);

  const applyPage = useCallback((rows: SupportRecentTicket[], pageHasMore: boolean, append: boolean) => {
    setTickets((prev) => (append ? [...prev, ...rows] : rows));
    setHasMore(pageHasMore);
  }, []);

  const fetchPage = useCallback(async (offset: number, limit: number, append: boolean) => {
    const page = await listMySupportTicketsPage(offset, limit);
    applyPage(page.tickets, page.hasMore, append);
    return page;
  }, [applyPage]);

  const refetchVisible = useCallback(() => {
    const limit = Math.max(ticketsLengthRef.current, SUPPORT_TICKET_LIST_INITIAL);
    return fetchPage(0, limit, false)
      .catch(() => {
        setTickets([]);
        setHasMore(false);
      })
      .finally(() => {
        setTicketsLoaded(true);
      });
  }, [fetchPage]);

  useEffect(() => {
    let cancelled = false;
    void fetchPage(0, SUPPORT_TICKET_LIST_INITIAL, false)
      .catch(() => {
        if (!cancelled) {
          setTickets([]);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) setTicketsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    void fetchPage(ticketsLengthRef.current, SUPPORT_TICKET_LIST_LOAD_MORE, true)
      .catch(() => undefined)
      .finally(() => {
        setLoadingMore(false);
      });
  }, [fetchPage, hasMore, loadingMore]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current !== null) return;
    refetchTimerRef.current = window.setTimeout(() => {
      refetchTimerRef.current = null;
      void refetchVisible();
    }, 400);
  }, [refetchVisible]);

  useEffect(() => {
    return () => {
      if (refetchTimerRef.current !== null) {
        window.clearTimeout(refetchTimerRef.current);
      }
    };
  }, []);

  const scheduleRefetchRef = useRef(scheduleRefetch);
  scheduleRefetchRef.current = scheduleRefetch;

  useEffect(() => {
    const onEvent = (event: SupportRealtimeEvent) => {
      if (event.type !== "ticket:updated" && event.type !== "conversation:locked") {
        return;
      }
      setTickets((prev) => {
        const result = patchSupportTicketListFromRealtime(prev, event);
        if (result.needsRefetch) {
          scheduleRefetchRef.current();
        }
        return result.changed ? result.tickets : prev;
      });
    };

    return connectSupportRealtime({ onEvent });
  }, []);

  return {
    tickets,
    ticketsLoaded,
    hasMore,
    loadingMore,
    loadMore,
    refetch: refetchVisible,
  };
}
