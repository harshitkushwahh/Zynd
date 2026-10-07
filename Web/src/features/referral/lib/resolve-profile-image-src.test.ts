import { describe, expect, it } from "vitest";

import { resolveProfileImageSrc } from "@/features/referral/lib/resolve-profile-image-src";

const path = "/api/v1/documents/public/11111111-1111-1111-1111-111111111111?v=2";

describe("resolveProfileImageSrc", () => {
  it("points a relative API path at the API origin", () => {
    expect(resolveProfileImageSrc(path, "https://api.zynd.shop/api/v1")).toBe(
      `https://api.zynd.shop${path}`,
    );
  });

  it("keeps a same-origin path when the API base is proxied", () => {
    expect(resolveProfileImageSrc(path, "/api/v1")).toBe(path);
  });

  it("leaves absolute, blob, and empty values unchanged", () => {
    expect(resolveProfileImageSrc("https://cdn.example/photo.jpg", "/api/v1")).toBe(
      "https://cdn.example/photo.jpg",
    );
    expect(resolveProfileImageSrc("blob:http://localhost/abc", "https://api.zynd.shop/api/v1")).toBe(
      "blob:http://localhost/abc",
    );
    expect(resolveProfileImageSrc("  ", "/api/v1")).toBeNull();
    expect(resolveProfileImageSrc(null, "/api/v1")).toBeNull();
  });
});
