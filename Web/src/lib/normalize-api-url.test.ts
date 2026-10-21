import { describe, expect, it } from "vitest";

import { normalizeBackendOrigin, normalizePublicApiUrl } from "@zynd/shared/api";

describe("normalizePublicApiUrl", () => {
  it("keeps relative BFF default", () => {
    expect(normalizePublicApiUrl(undefined)).toBe("/api/v1");
    expect(normalizePublicApiUrl("/api/v1")).toBe("/api/v1");
  });

  it("appends /api/v1 to bare API host", () => {
    expect(normalizePublicApiUrl("https://api.zynd.shop")).toBe("https://api.zynd.shop/api/v1");
    expect(normalizePublicApiUrl("https://api.zynd.shop/")).toBe("https://api.zynd.shop/api/v1");
  });

  it("does not double-append /api/v1", () => {
    expect(normalizePublicApiUrl("https://api.zynd.shop/api/v1")).toBe(
      "https://api.zynd.shop/api/v1",
    );
  });
});

describe("normalizeBackendOrigin", () => {
  it("strips trailing /api/v1 for BFF proxy target", () => {
    expect(normalizeBackendOrigin("https://api.zynd.shop/api/v1")).toBe("https://api.zynd.shop");
    expect(normalizeBackendOrigin("https://api.zynd.shop")).toBe("https://api.zynd.shop");
  });
});
