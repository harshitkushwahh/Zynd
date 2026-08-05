import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-keys";

describe("queryKeys", () => {
  it("uses stable invest order keys for the same limit", () => {
    expect(queryKeys.invest.orders(100)).toEqual(queryKeys.invest.orders(100));
    expect(queryKeys.invest.orders()).toEqual(queryKeys.invest.orders(100));
  });

  it("scopes notification list keys by filter params", () => {
    const a = queryKeys.notifications.list({ limit: 20, offset: 0, unreadOnly: false });
    const b = queryKeys.notifications.list({ limit: 20, offset: 20, unreadOnly: false });
    const c = queryKeys.notifications.list({ limit: 20, offset: 0, unreadOnly: true });

    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toEqual(queryKeys.notifications.list({ limit: 20, offset: 0, unreadOnly: false }));
  });

  it("prefixes domain invalidation keys", () => {
    expect(queryKeys.invest.all()).toEqual(["invest"]);
    expect(queryKeys.family.all()).toEqual(["family"]);
    expect(queryKeys.goals.all()).toEqual(["goals"]);
  });
});
