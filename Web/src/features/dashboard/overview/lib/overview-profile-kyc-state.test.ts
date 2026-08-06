import { describe, expect, it } from "vitest";

import { buildOverviewKycProfileProgress } from "@/features/dashboard/overview/lib/overview-profile-kyc-state";
import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";

function bootstrap(overrides: Partial<KycBootstrapResponse> = {}): KycBootstrapResponse {
  return {
    eligible: true,
    reasons: [],
    last_completed_step: null,
    active_step_index: 0,
    pan_draft: null,
    contact_draft: null,
    personal_draft: null,
    nominee_draft: null,
    bank_draft: null,
    kyc_already_registered: false,
    readiness_code: null,
    readiness_reason: null,
    pan_verification_status: null,
    pan_verification_failure: null,
    external_identity_document_id: null,
    external_kyc_status: null,
    digilocker_failure_reason: null,
    bank_verification_status: null,
    bank_verification_failure: null,
    poa_bank_preverify_id: null,
    poa_bank_proof_file_id: null,
    signature_draft: null,
    external_kyc_form_id: null,
    kyc_form_status: null,
    kyc_form_type: null,
    kyc_form_failure_reason: null,
    proof_details_status: null,
    esign_details_status: null,
    geolocation_draft: null,
    step_statuses: {
      pan: "pending",
      digilocker: "pending",
      address: "pending",
      personal: "pending",
      nominee: "pending",
      bank: "pending",
      signature: "pending",
      review: "pending",
      overall: "in_progress",
    },
    ...overrides,
  };
}

describe("buildOverviewKycProfileProgress", () => {
  it("uses pan step icon metadata at the start of the journey", () => {
    const progress = buildOverviewKycProfileProgress(bootstrap());
    expect(progress.activeStepId).toBe("pan-card");
    expect(progress.progressFraction).toBe(0);
    expect(progress.tone).toBe("warning");
  });

  it("marks completed journeys as verified", () => {
    const progress = buildOverviewKycProfileProgress(
      bootstrap({
        active_step_index: 6,
        step_statuses: {
          pan: "verified",
          digilocker: "skipped",
          address: "saved",
          personal: "saved",
          nominee: "saved",
          bank: "verified",
          signature: "skipped",
          review: "saved",
          overall: "completed",
        },
      }),
    );
    expect(progress.progressFraction).toBe(1);
    expect(progress.tone).toBe("success");
  });
});
