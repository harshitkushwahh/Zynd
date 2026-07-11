"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  fetchNotifications,
  fetchUnreadNotificationCount,
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
import { useWebPushNotificationBridge } from "@/features/notifications/components/web-push-bridge";
import { ToastNotificationIcon } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/auth-context";

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const toastedIdsRef = useRef<Set<string>>(new Set());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  const markRead = useCallback(async (notificationId: string) => {
    const updated = await markNotificationRead(notificationId);
    setNotifications((current) =>
      current.map((item) => (item.id === notificationId ? updated : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const navigateFromToast = useNotificationNavigation(undefined, { markReadOnNavigate: false });
  const notificationsRef = useRef<NotificationItem[]>([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const applyStreamNotification = useCallback(
    (payload: NotificationStreamPayload) => {
      const item = toNotificationItem(payload);
      const isNew = !notificationsRef.current.some((entry) => entry.id === item.id);

      if (isNew) {
        setNotifications((current) => [item, ...current].slice(0, 20));
        if (!item.read_at) {
          setUnreadCount((current) => Math.max(current + 1, payload.unread_count));
        } else {
          setUnreadCount(payload.unread_count);
        }
      } else {
        setUnreadCount(payload.unread_count);
      }

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
    [navigateFromToast],
  );

  useWebPushNotificationBridge(applyStreamNotification);

  const applyStreamNotificationRef = useRef(applyStreamNotification);
  applyStreamNotificationRef.current = applyStreamNotification;

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications((current) => (current.length === 0 ? current : []));
      setUnreadCount((count) => (count === 0 ? count : 0));
      return;
    }

    setLoading(true);
    try {
      const [list, unread] = await Promise.all([
        fetchNotifications({ limit: 20 }),
        fetchUnreadNotificationCount(),
      ]);
      setNotifications(list.items);
      setUnreadCount(unread.unread_count);

      for (const item of list.items) {
        toastedIdsRef.current.add(item.id);
      }
    } catch {
      // Keep last known state on transient failures.
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const userId = user?.id ?? null;

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
    );
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!userId) {
      toastedIdsRef.current.clear();
      reconnectAttemptRef.current = 0;
      setNotifications((current) => (current.length === 0 ? current : []));
      setUnreadCount((count) => (count === 0 ? count : 0));
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
              void refreshRef.current();
            },
            onNotification: (payload) => {
              applyStreamNotificationRef.current(payload);
            },
            onUnreadCount: (count) => {
              setUnreadCount((current) => (current === count ? current : count));
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

    void refreshRef.current();
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
  }, [userId]);

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
