import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import type { NotificationListResponse } from "@/features/notifications/api/notifications-api";
import {
  patchNotificationInListCaches,
  prependNotificationToListCaches,
} from "@/features/notifications/lib/patch-notifications-query-cache";
import { queryKeys } from "@/lib/query-keys";

const sampleItem = {
  id: "a",
  category: "account" as const,
  notification_type: "test",
  title: "T",
  body: "",
  metadata: null,
  read_at: null,
  created_at: "2026-01-01",
};

describe("patch-notifications-query-cache", () => {
  it("prepends to the first page of all notifications", () => {
    const queryClient = new QueryClient();
    const listKey = queryKeys.notifications.list({ limit: 20, offset: 0, unreadOnly: false });
    const existing: NotificationListResponse = {
      items: [sampleItem],
      total: 1,
      unread_count: 1,
    };
    queryClient.setQueryData(listKey, existing);

    prependNotificationToListCaches(
      queryClient,
      {
        ...sampleItem,
        id: "b",
        title: "New",
        created_at: "2026-01-02",
      },
      2,
    );

    const next = queryClient.getQueryData<NotificationListResponse>(listKey);
    expect(next?.items.map((item) => item.id)).toEqual(["b", "a"]);
    expect(next?.unread_count).toBe(2);
  });

  it("patches read state in cached list pages", () => {
    const queryClient = new QueryClient();
    const listKey = queryKeys.notifications.list({ limit: 20, offset: 0, unreadOnly: false });
    queryClient.setQueryData<NotificationListResponse>(listKey, {
      items: [sampleItem],
      total: 1,
      unread_count: 1,
    });

    patchNotificationInListCaches(queryClient, "a", (item) => ({
      ...item,
      read_at: "2026-01-02T00:00:00.000Z",
    }));

    const next = queryClient.getQueryData<NotificationListResponse>(listKey);
    expect(next?.items[0]?.read_at).toBe("2026-01-02T00:00:00.000Z");
    expect(next?.unread_count).toBe(0);
  });
});
