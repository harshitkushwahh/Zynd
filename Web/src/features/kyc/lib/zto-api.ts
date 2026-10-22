import { apiRequest } from "@/lib/api-client";
import type {
  ZtoAcceptResponse,
  ZtoConfig,
  ZtoFlowStatus,
  ZtoPhase,
  ZtoReviewData,
  ZtoReviewFields,
} from "@/features/kyc/lib/zto-types";

export type { ZtoConfig, ZtoFlowStatus, ZtoPhase, ZtoReviewData, ZtoReviewFields } from "@/features/kyc/lib/zto-types";

export function fetchZtoConfig() {
  return apiRequest<ZtoConfig>("/kyc/zero-touch/config");
}

export function fetchZtoFlowStatus() {
  return apiRequest<ZtoFlowStatus>("/kyc/zero-touch/flow/status");
}

export function startZtoFlow(name?: string) {
  return apiRequest<ZtoFlowStatus>("/kyc/zero-touch/flow/start", {
    method: "POST",
    body: JSON.stringify(name ? { name } : {}),
  });
}

export function optInZtoFlow(bankConsent: boolean, customerConsent: boolean) {
  return apiRequest<ZtoFlowStatus>("/kyc/zero-touch/flow/opt-in", {
    method: "POST",
    body: JSON.stringify({
      zto_bank_consent: bankConsent,
      zto_customer_consent: customerConsent,
    }),
  });
}

export function fetchZtoReviewData() {
  return apiRequest<ZtoReviewData>("/kyc/zero-touch/review-data");
}

export function acceptZtoReview(fields: ZtoReviewFields) {
  return apiRequest<ZtoAcceptResponse>("/kyc/zero-touch/review/accept", {
    method: "POST",
    body: JSON.stringify(fields),
  });
}

export function declineZtoReview() {
  return apiRequest<{ phase: ZtoPhase }>("/kyc/zero-touch/review/decline", {
    method: "POST",
  });
}
