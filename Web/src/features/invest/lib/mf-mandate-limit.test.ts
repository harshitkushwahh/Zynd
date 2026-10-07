import { describe, expect, it } from "vitest";

import type { MfMandate } from "@/features/invest/api/invest-api";
import {
  findCoveringApprovedMandate,
  requiredMandateLimitInr,
} from "@/features/invest/lib/mf-mandate-limit";

function mandate(overrides: Partial<MfMandate>): MfMandate {
  return {
    mandate_id: "m1",
    status: "APPROVED",
    fp_mandate_id: 1,
    bank_account_old_id: 1,
    mandate_type: "UPI",
    mandate_limit: 15_000,
    fp_mandate_status: "APPROVED",
    auth_url: null,
    next_action: null,
    failure_code: null,
    failure_reason: null,
    created_at: null,
    approved_at: null,
    investor_bank_account_id: "bank-1",
    bank_name: null,
    bank_account_masked: null,
    bank_ifsc_code: null,
    ...overrides,
  };
}

describe("requiredMandateLimitInr", () => {
  it("picks up to 15k, 50k, or 1 lakh from the SIP amount", () => {
    expect(requiredMandateLimitInr(1_000)).toBe(15_000);
    expect(requiredMandateLimitInr(14_999)).toBe(15_000);
    expect(requiredMandateLimitInr(15_000)).toBe(50_000);
    expect(requiredMandateLimitInr(49_999)).toBe(50_000);
    expect(requiredMandateLimitInr(50_000)).toBe(100_000);
  });
});

describe("findCoveringApprovedMandate", () => {
  it("uses an approved mandate that covers the required limit on the selected bank", () => {
    const covering = findCoveringApprovedMandate(
      [mandate({ mandate_limit: 15_000 }), mandate({ mandate_id: "m2", mandate_limit: 50_000 })],
      { bankAccountId: "bank-1", mandateType: "upi", requiredLimitInr: 15_000 },
    );
    expect(covering?.mandate_id).toBe("m2");
  });

  it("ignores a smaller or different-bank mandate", () => {
    expect(
      findCoveringApprovedMandate([mandate({ mandate_limit: 15_000 })], {
        bankAccountId: "bank-1",
        mandateType: "upi",
        requiredLimitInr: 50_000,
      }),
    ).toBeNull();
    expect(
      findCoveringApprovedMandate([mandate({ investor_bank_account_id: "other" })], {
        bankAccountId: "bank-1",
        mandateType: "upi",
        requiredLimitInr: 15_000,
      }),
    ).toBeNull();
  });
});
