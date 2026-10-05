import { describe, expect, it } from "vitest";

import {
  capReachableStepIndex,
  isDigilockerComplete,
  shouldFocusReviewAfterPartnerReturn,
} from "@/features/kyc/lib/kyc-pan-readiness";
import { KYC_JOURNEY_STEPS } from "@/features/kyc/lib/kyc-journey";

describe("isDigilockerComplete", () => {
  it("requires returned_success and identity document id", () => {
    expect(
      isDigilockerComplete({
        external_kyc_status: "returned_success",
        external_identity_document_id: "iddoc_abc",
        contact_draft: { line1: "1 Main St" },
      }),
    ).toBe(true);
  });

  it("does not treat manual contact draft as DigiLocker complete", () => {
    expect(
      isDigilockerComplete({
        external_kyc_status: "started",
        external_identity_document_id: "iddoc_abc",
        contact_draft: { line1: "1 Main St" },
      }),
    ).toBe(false);
  });
});

describe("capReachableStepIndex", () => {
  it("does not cap when Path A DigiLocker returned success", () => {
    const index = capReachableStepIndex(6, KYC_JOURNEY_STEPS, {
      kyc_already_registered: false,
      readiness_code: "kyc_unavailable",
      external_kyc_status: "returned_success",
      external_identity_document_id: "iddoc_abc",
      contact_draft: { line1: "1 Main St" },
    });
    expect(index).toBe(6);
  });

  it("caps at address while DigiLocker is still required", () => {
    const index = capReachableStepIndex(6, KYC_JOURNEY_STEPS, {
      kyc_already_registered: false,
      readiness_code: "kyc_unavailable",
      external_kyc_status: "started",
      external_identity_document_id: "iddoc_abc",
    });
    expect(index).toBe(1);
  });
});

describe("shouldFocusReviewAfterPartnerReturn", () => {
  it("does not focus review when phase 1 was never completed", () => {
    expect(
      shouldFocusReviewAfterPartnerReturn(
        {
          last_completed_step: "pan",
          contact_draft: null,
          personal_draft: null,
          readiness_code: "kyc_unavailable",
        } as import("@/features/kyc/lib/kyc-api").KycBootstrapResponse,
        { esignReturnActive: false, pendingEsignResume: true },
      ),
    ).toBe(false);
  });
});
