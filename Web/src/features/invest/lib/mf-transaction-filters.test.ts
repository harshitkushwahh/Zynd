import { describe, expect, it } from "vitest";

import type { MfOrder } from "@/features/invest/api/invest-api";
import { isUpcomingHoldingOrder } from "@/features/invest/lib/mf-transaction-filters";

function order(partial: Partial<MfOrder> & Pick<MfOrder, "status">): MfOrder {
  return {
    order_id: "test-order",
    product_id: "product",
    order_type: "LUMPSUM",
    amount_inr: 100,
    payment_completed: false,
    ...partial,
  } as MfOrder;
}

describe("isUpcomingHoldingOrder", () => {
  it("excludes unpaid payment-pending orders from portfolio upcoming", () => {
    expect(
      isUpcomingHoldingOrder(
        order({
          status: "PAYMENT_PENDING",
          fp_payment_status: "PENDING",
          payment_completed: false,
        }),
      ),
    ).toBe(false);
  });

  it("includes paid orders awaiting unit allotment", () => {
    expect(
      isUpcomingHoldingOrder(
        order({
          status: "SUBMITTED",
          fp_state: "submitted",
          payment_completed: true,
        }),
      ),
    ).toBe(true);
  });
});
