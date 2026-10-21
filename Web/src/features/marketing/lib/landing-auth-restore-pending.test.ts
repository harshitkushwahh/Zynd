import { describe, expect, it, vi } from "vitest";

import { isLandingAuthRestorePending } from "@/features/marketing/lib/landing-auth-restore-pending";

vi.mock("@/features/auth/api/auth-response", () => ({
  hasSessionHint: () => true,
}));

describe("isLandingAuthRestorePending", () => {
  it("returns true when session hint exists but user is not loaded", () => {
    expect(
      isLandingAuthRestorePending({
        user: null,
        loading: false,
        sessionRestoring: false,
        sessionRetrying: false,
      }),
    ).toBe(true);
  });

  it("returns false when user is present", () => {
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
