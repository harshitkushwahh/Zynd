import { describe, expect, it } from "vitest";

import { resolveNotificationDeepLink } from "@zynd/shared/notifications";

describe("resolveNotificationDeepLink", () => {
  it("routes KYC notifications to the KYC journey", () => {
    expect(
      resolveNotificationDeepLink({
        notification_type: "kyc.completed",
        category: "kyc",
      }),
    ).toEqual({ path: "/dashboard/kyc" });
  });

  it("routes referral signup notifications to referrals list", () => {
    expect(
      resolveNotificationDeepLink({
        notification_type: "referral.user.signed_up",
        category: "referral",
      }),
    ).toEqual({ path: "/dashboard/referral/referrals" });
  });

  it("falls back to notifications inbox for unknown types", () => {
    expect(
      resolveNotificationDeepLink({
        notification_type: "unknown.type",
      }),
    ).toEqual({ path: "/dashboard/notifications" });
  });
});
