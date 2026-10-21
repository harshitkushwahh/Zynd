import { describe, expect, it } from "vitest";

import {
  capReachableStepIndex,
  digilockerFailureDescription,
  isDigilockerComplete,
  shouldFocusReviewAfterPartnerReturn,
  shouldShowDigilockerFailureAlert,
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

describe("shouldShowDigilockerFailureAlert", () => {
  it("ignores Path A digilocker_failure_reason on KRA proof address step", () => {
    expect(
      shouldShowDigilockerFailureAlert({
        pan_verification_status: "verified",
        requires_address_step_proof_digilocker: true,
        proof_details_status: "pending",
        digilocker_failure_reason:
          "Aadhaar was not fetched. Enter your mobile number in DigiLocker, select the Aadhaar checkbox, and complete verification before returning.",
      } as import("@/features/kyc/lib/kyc-api").KycBootstrapResponse),
    ).toBe(false);
  });
});

describe("digilockerFailureDescription", () => {
  it("returns null for KRA proof flow", () => {
    expect(
      digilockerFailureDescription({
        requires_address_step_proof_digilocker: true,
        digilocker_failure_reason: "Aadhaar was not fetched.",
      } as import("@/features/kyc/lib/kyc-api").KycBootstrapResponse),
    ).toBeNull();
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
