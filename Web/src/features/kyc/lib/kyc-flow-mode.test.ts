import { describe, expect, it } from "vitest";

import { requiresAddressStepDigilocker } from "@/features/kyc/lib/kyc-flow-mode";

describe("kyc-flow-mode", () => {
  it("prefers requires_address_step_digilocker", () => {
    expect(
      requiresAddressStepDigilocker({
        requires_address_step_digilocker: true,
        requires_pan_step_digilocker: false,
        requires_digilocker: false,
      }),
    ).toBe(true);
  });

  it("falls back to requires_pan_step_digilocker then requires_digilocker", () => {
    expect(
      requiresAddressStepDigilocker({
        requires_pan_step_digilocker: true,
        requires_digilocker: false,
      }),
    ).toBe(true);
    expect(
      requiresAddressStepDigilocker({
        requires_pan_step_digilocker: null,
        requires_digilocker: true,
      }),
    ).toBe(true);
  });
});
