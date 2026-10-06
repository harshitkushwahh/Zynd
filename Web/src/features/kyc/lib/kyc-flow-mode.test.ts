import { describe, expect, it } from "vitest";

import {
  isProofDetailsComplete,
  requiresAddressStepDigilocker,
  requiresAddressStepProofDigilocker,
} from "@/features/kyc/lib/kyc-flow-mode";

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

  it("uses proof digilocker for on-hold and update, not identity digilocker", () => {
    expect(
      requiresAddressStepProofDigilocker({
        kyc_flow_mode: "kra_update",
        requires_address_step_proof_digilocker: true,
      }),
    ).toBe(true);
    expect(
      requiresAddressStepDigilocker({
        requires_address_step_digilocker: false,
        requires_digilocker: false,
      }),
    ).toBe(false);
    expect(isProofDetailsComplete("fetched")).toBe(true);
    expect(isProofDetailsComplete("pending")).toBe(false);
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
