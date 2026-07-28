"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/features/notifications/api/notifications-api";
import {
  connectNotificationStream,
  toNotificationItem,
  type NotificationStreamPayload,
} from "@/features/notifications/api/notification-stream";
import { useNotificationNavigation } from "@/features/notifications/hooks/use-notification-navigation";
import {
  patchNotificationPreviewCache,
  useNotificationsPreviewQuery,
} from "@/features/notifications/hooks/use-notifications-list-query";
import { useUnreadNotificationCountQuery } from "@/features/notifications/hooks/use-unread-notification-count-query";
import {
  markAllNotificationsReadInListCaches,
  patchNotificationInListCaches,
  prependNotificationToListCaches,
} from "@/features/notifications/lib/patch-notifications-query-cache";
import { useWebPushNotificationBridge } from "@/features/notifications/components/web-push-bridge";
import { ToastNotificationIcon } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/auth-context";
import { queryKeys } from "@/lib/query-keys";

type NotificationContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const FALLBACK_POLL_INTERVAL_MS = 5 * 60 * 1000;
const STREAM_RECONNECT_BASE_MS = 3_000;
const STREAM_RECONNECT_MAX_MS = 30_000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const enabled = Boolean(userId);

  const previewQuery = useNotificationsPreviewQuery(enabled);
  const unreadQuery = useUnreadNotificationCountQuery(enabled);

  const notifications = previewQuery.data?.items ?? [];
  const unreadCount =
    unreadQuery.data?.unread_count ?? previewQuery.data?.unread_count ?? 0;
  const loading = previewQuery.isPending && !previewQuery.data;

  const toastedIdsRef = useRef<Set<string>>(new Set());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const notificationsRef = useRef<NotificationItem[]>([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    if (!enabled) return;
    for (const item of notifications) {
      toastedIdsRef.current.add(item.id);
    }
  }, [enabled, notifications]);

  const navigateFromToast = useNotificationNavigation(undefined, { markReadOnNavigate: false });

  const applyStreamNotification = useCallback(
    (payload: NotificationStreamPayload) => {
      const item = toNotificationItem(payload);
      const isNew = !notificationsRef.current.some((entry) => entry.id === item.id);

      if (isNew) {
        patchNotificationPreviewCache(queryClient, (current) => {
          if (!current) return current;
          if (current.items.some((entry) => entry.id === item.id)) {
            return { ...current, unread_count: payload.unread_count };
          }
          return {
            ...current,
            items: [item, ...current.items].slice(0, 20),
            total: current.total + 1,
            unread_count: payload.unread_count,
          };
        });
        prependNotificationToListCaches(queryClient, item, payload.unread_count);
      }

      queryClient.setQueryData(queryKeys.notifications.unread(), {
        unread_count: payload.unread_count,
      });

      if (toastedIdsRef.current.has(item.id)) {
        return;
      }
      toastedIdsRef.current.add(item.id);

      if (!item.read_at) {
        toast(item.title, {
          description: item.body,
          icon: <ToastNotificationIcon className="size-4 text-primary" strokeWidth={2.25} />,
          action: {
            label: "View",
            onClick: () => navigateFromToast(item),
          },
        });
      }
    },
    [navigateFromToast, queryClient],
  );

  useWebPushNotificationBridge(applyStreamNotification);

  const applyStreamNotificationRef = useRef(applyStreamNotification);
  applyStreamNotificationRef.current = applyStreamNotification;

  const refresh = useCallback(async () => {
    if (!userId) {
      queryClient.removeQueries({ queryKey: queryKeys.notifications.all() });
      return;
    }

    await Promise.all([previewQuery.refetch(), unreadQuery.refetch()]);
  }, [previewQuery, queryClient, unreadQuery, userId]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const markRead = useCallback(
    async (notificationId: string) => {
      const updated = await markNotificationRead(notificationId);
      let wasUnread = false;
      patchNotificationPreviewCache(queryClient, (current) => {
        if (!current) return current;
        wasUnread = current.items.some(
          (item) => item.id === notificationId && !item.read_at,
        );
        return {
          ...current,
          items: current.items.map((item) => (item.id === notificationId ? updated : item)),
          unread_count: wasUnread
            ? Math.max(0, current.unread_count - 1)
            : current.unread_count,
        };
      });
      patchNotificationInListCaches(queryClient, notificationId, () => updated);
      if (wasUnread) {
        queryClient.setQueryData(
          queryKeys.notifications.unread(),
          (current: { unread_count: number } | undefined) => ({
            unread_count: Math.max(0, (current?.unread_count ?? unreadCount) - 1),
          }),
        );
      }
    },
    [queryClient, unreadCount],
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    const readAt = new Date().toISOString();
    patchNotificationPreviewCache(queryClient, (current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => ({
          ...item,
          read_at: item.read_at ?? readAt,
        })),
        unread_count: 0,
      };
    });
    queryClient.setQueryData(queryKeys.notifications.unread(), { unread_count: 0 });
    markAllNotificationsReadInListCaches(queryClient, readAt);
  }, [queryClient]);

  useEffect(() => {
    if (!userId) {
      toastedIdsRef.current.clear();
      reconnectAttemptRef.current = 0;
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) {
        return;
      }
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(
        STREAM_RECONNECT_BASE_MS * 2 ** attempt,
        STREAM_RECONNECT_MAX_MS,
      );
      reconnectAttemptRef.current = attempt + 1;
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(() => {
        void startStream();
      }, delay);
    };

    const startStream = async () => {
      if (cancelled) {
        return;
      }

      try {
        await connectNotificationStream(
          {
            onConnected: () => {
              reconnectAttemptRef.current = 0;
              const previewState = queryClient.getQueryState(queryKeys.notifications.preview());
              const unreadState = queryClient.getQueryState(queryKeys.notifications.unread());
              const now = Date.now();
              const staleMs = 30_000;
              const previewFresh =
                previewState?.dataUpdatedAt != null &&
                now - previewState.dataUpdatedAt < staleMs;
              const unreadFresh =
                unreadState?.dataUpdatedAt != null &&
                now - unreadState.dataUpdatedAt < staleMs;
              if (previewFresh && unreadFresh) {
                return;
              }
              void refreshRef.current();
            },
            onNotification: (payload) => {
              applyStreamNotificationRef.current(payload);
            },
            onUnreadCount: (count) => {
              queryClient.setQueryData(queryKeys.notifications.unread(), { unread_count: count });
            },
            onDisconnect: scheduleReconnect,
          },
          abortController.signal,
        );
      } catch {
        if (!cancelled && !abortController.signal.aborted) {
          scheduleReconnect();
        }
      }
    };

    void startStream();

    const fallbackInterval = window.setInterval(() => {
      void refreshRef.current();
    }, FALLBACK_POLL_INTERVAL_MS);

    const onFocus = () => {
      void refreshRef.current();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      abortController.abort();
      clearReconnectTimer();
      window.clearInterval(fallbackInterval);
      window.removeEventListener("focus", onFocus);
    };
  }, [queryClient, userId]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markRead,
      markAllRead,
    }),
    [loading, markAllRead, markRead, notifications, refresh, unreadCount],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
