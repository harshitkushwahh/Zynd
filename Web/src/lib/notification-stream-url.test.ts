import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configureApiClient,
  getNotificationStreamUrl,
  getSupportWebSocketUrl,
} from "@zynd/shared/api";

describe("getNotificationStreamUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    configureApiClient({ apiUrl: "/api/v1" });
  });

  it("uses absolute api base when configured", () => {
    configureApiClient({ apiUrl: "https://api.zynd.shop/api/v1" });
    expect(getNotificationStreamUrl()).toBe(
      "https://api.zynd.shop/api/v1/notifications/stream",
    );
  });

  it("bypasses Next proxy when api base is relative", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_WS_ORIGIN", "wss://api.zynd.shop");
    configureApiClient({ apiUrl: "/api/v1" });
    expect(getNotificationStreamUrl()).toBe(
      "https://api.zynd.shop/api/v1/notifications/stream",
    );
    expect(getSupportWebSocketUrl("token")).toBe(
      "wss://api.zynd.shop/api/v1/support/ws?token=token",
    );
  });
});
