import { describe, expect, it } from "vitest";

import { isLandingAuthRestorePending } from "@/features/marketing/lib/landing-auth-restore-pending";

describe("isLandingAuthRestorePending", () => {
  it("returns true while session restore is in progress", () => {
    expect(
      isLandingAuthRestorePending({
        user: null,
        loading: false,
        sessionRestoring: true,
        sessionRetrying: false,
      }),
    ).toBe(true);
  });

  it("returns false after bootstrap completes with no user", () => {
    expect(
      isLandingAuthRestorePending({
        user: null,
        loading: false,
        sessionRestoring: false,
        sessionRetrying: false,
      }),
    ).toBe(false);
  });

  it("returns false when user is present and bootstrap finished", () => {
    expect(
      isLandingAuthRestorePending({
        user: { id: "1", email: "a@b.com" } as never,
        loading: false,
        sessionRestoring: false,
        sessionRetrying: false,
      }),
    ).toBe(false);
  });
});
