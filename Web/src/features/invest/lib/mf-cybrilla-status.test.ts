import { describe, expect, it } from "vitest";

import { resolveCybrillaOrderStatusLabel } from "@/features/invest/lib/mf-cybrilla-status";
import { copy } from "@/shared/config/copy";

describe("resolveCybrillaOrderStatusLabel", () => {
  it("shows gateway payment status before payment completes", () => {
    const label = resolveCybrillaOrderStatusLabel({
      status: "SUBMITTED",
      fp_state: "submitted",
      fp_payment_status: "PENDING",
      payment_completed: false,
      order_type: "LUMPSUM",
    });
    expect(label).toBe("Pending");
  });

  it("does not show AMC submitted when payment is still open", () => {
    const label = resolveCybrillaOrderStatusLabel({
      status: "SUBMITTED",
      fp_state: "submitted",
      fp_payment_status: null,
      payment_completed: false,
      order_type: "LUMPSUM",
    });
    expect(label).toBe("Pending");
  });

  it("shows purchase state after payment completes", () => {
    const label = resolveCybrillaOrderStatusLabel({
      status: "SUBMITTED",
      fp_state: "submitted",
      fp_payment_status: "SUCCESS",
      payment_completed: true,
      order_type: "LUMPSUM",
    });
    expect(label).toBe("Submitted");
  });
});
