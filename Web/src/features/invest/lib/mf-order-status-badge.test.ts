import { describe, expect, it } from "vitest";

import {
  formatMfOrderStatusLabel,
  mfOrderStatusVariantForInvestor,
} from "@/features/invest/lib/mf-order-journey-copy";
import { copy } from "@/shared/config/copy";

describe("mf order status badge", () => {
  it("uses one yellow Pending label for unpaid purchase orders", () => {
    const cases = [
      {
        status: "PAYMENT_PENDING",
        fp_state: "submitted",
        fp_payment_status: null,
      },
      {
        status: "SUBMITTED",
        fp_state: "submitted",
        fp_payment_status: "PENDING",
      },
      {
        status: "PENDING",
        fp_state: "pending",
        fp_payment_status: null,
      },
    ] as const;

    for (const order of cases) {
      expect(
        formatMfOrderStatusLabel(order.status, {
          ...order,
          payment_completed: false,
          order_type: "LUMPSUM",
        }),
      ).toBe(copy.transactions.orderStatusPending);
      expect(
        mfOrderStatusVariantForInvestor(order.status, {
          ...order,
          payment_completed: false,
          order_type: "LUMPSUM",
        }),
      ).toBe("warning");
    }
  });

  it("shows failed badge when order is canceled, not Pending", () => {
    expect(
      formatMfOrderStatusLabel("CANCELLED", {
        status: "CANCELLED",
        fp_state: "submitted",
        fp_payment_status: "PENDING",
        payment_completed: false,
        order_type: "LUMPSUM",
        failure_code: "payment_abandoned",
      }),
    ).toBe(copy.transactions.orderStatusPaymentCanceled);
    expect(
      mfOrderStatusVariantForInvestor("CANCELLED", {
        status: "CANCELLED",
        fp_state: "submitted",
        fp_payment_status: "PENDING",
        payment_completed: false,
        order_type: "LUMPSUM",
        failure_code: "payment_abandoned",
      }),
    ).toBe("destructive");
  });

  it("shows awaiting OTP for an unconfirmed switch, not payment completed", () => {
    expect(
      formatMfOrderStatusLabel("PENDING", {
        status: "PENDING",
        fp_state: null,
        fp_payment_status: null,
        payment_completed: true,
        order_type: "SWITCH",
      }),
    ).toBe(copy.dashboard.portfolio.redeemJourneyStatusAwaitingConsent);
    expect(
      mfOrderStatusVariantForInvestor("PENDING", {
        status: "PENDING",
        fp_state: null,
        fp_payment_status: null,
        payment_completed: true,
        order_type: "SWITCH",
      }),
    ).toBe("warning");
  });
});
