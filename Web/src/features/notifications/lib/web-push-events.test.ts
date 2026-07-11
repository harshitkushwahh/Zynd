import { describe, expect, it } from "vitest";

import { parseFcmDataPayload } from "@/features/notifications/lib/web-push-events";

describe("parseFcmDataPayload", () => {
  it("parses a valid FCM data payload", () => {
    const payload = parseFcmDataPayload({
      notification_id: "notif-1",
      notification_type: "kyc.completed",
      category: "kyc",
      title: "KYC complete",
      body: "Your KYC is approved",
      unread_count: "4",
      metadata: '{"status":"approved"}',
    });

    expect(payload).toMatchObject({
      id: "notif-1",
      notification_type: "kyc.completed",
      category: "kyc",
      title: "KYC complete",
      body: "Your KYC is approved",
      unread_count: 4,
      metadata: { status: "approved" },
    });
  });

  it("returns null when required fields are missing", () => {
    expect(
      parseFcmDataPayload({
        notification_id: "notif-1",
        title: "Missing fields",
      }),
    ).toBeNull();
  });
});
