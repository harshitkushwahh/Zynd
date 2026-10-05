import { describe, expect, it } from "vitest";

import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";
import { createEmptyJourneyDraft } from "@/features/kyc/lib/kyc-journey-draft";
import { kycPanResetRequiresConfirm, kycPanOnFile } from "@/features/kyc/lib/kyc-pan-reset";

describe("kycPanResetRequiresConfirm", () => {
  it("requires confirm when PAN is verified and journey progressed past PAN", () => {
    const bootstrap = {
      pan_verification_status: "verified",
      last_completed_step: "review",
    } as KycBootstrapResponse;

    expect(kycPanResetRequiresConfirm(bootstrap, createEmptyJourneyDraft())).toBe(true);
  });

  it("treats mononym PAN drafts as on file with first name only", () => {
    const bootstrap = {
      pan_verification_status: null,
      pan_draft: {
        panMasked: "ABCDE****F",
        firstName: "Madonna",
        lastName: "",
      },
    } as KycBootstrapResponse;

    expect(kycPanOnFile(bootstrap, createEmptyJourneyDraft())).toBe(true);
  });

  it("requires confirm when PAN is on file only in bootstrap and user reached bank step", () => {
    const bootstrap = {
      pan_verification_status: null,
      pan_draft: {
        panMasked: "ABCDE****F",
        firstName: "Test",
        lastName: "User",
      },
      last_completed_step: null,
    } as KycBootstrapResponse;

    expect(kycPanOnFile(bootstrap, createEmptyJourneyDraft())).toBe(true);
    expect(
      kycPanResetRequiresConfirm(bootstrap, createEmptyJourneyDraft(), {
        panStepIndex: 0,
        maxReachableStepIndex: 4,
      }),
    ).toBe(true);
  });

  it("does not require confirm when only PAN is verified without saved progress", () => {
    const bootstrap = {
      pan_verification_status: "verified",
      last_completed_step: null,
    } as KycBootstrapResponse;

    expect(
      kycPanResetRequiresConfirm(bootstrap, createEmptyJourneyDraft(), {
        panStepIndex: 0,
        maxReachableStepIndex: 0,
      }),
    ).toBe(false);
  });

  it("requires confirm when PAN verify persisted last_completed_step pan on the server", () => {
    const bootstrap = {
      pan_verification_status: "verified",
      last_completed_step: "pan",
    } as KycBootstrapResponse;

    expect(kycPanResetRequiresConfirm(bootstrap, createEmptyJourneyDraft())).toBe(true);
  });
});
