"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  inferDistributorNotificationKind,
  type DistributorNotification,
} from "@/lib/distributor-notifications-data";

type DistributorNotificationsContextValue = {
  notifications: DistributorNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (input: Pick<DistributorNotification, "title" | "body">) => void;
};

const DistributorNotificationsContext =
  createContext<DistributorNotificationsContextValue | null>(null);

export function DistributorNotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<DistributorNotification[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const markRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const addNotification = useCallback((input: Pick<DistributorNotification, "title" | "body">) => {
    setNotifications((current) => [
      {
        id: `n-${Date.now()}`,
        title: input.title,
        body: input.body,
        kind: inferDistributorNotificationKind(input.title, input.body),
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...current,
    ]);
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      addNotification,
    }),
    [addNotification, markAllRead, markRead, notifications, unreadCount],
  );

  return (
    <DistributorNotificationsContext.Provider value={value}>
      {children}
    </DistributorNotificationsContext.Provider>
  );
}

export function useDistributorNotifications() {
  const context = useContext(DistributorNotificationsContext);
  if (!context) {
    throw new Error("useDistributorNotifications must be used within DistributorNotificationsProvider");
  }
  return context;
}
