import { apiRequest } from "@/lib/api-client";
import type {
  StepUpOptions,
  StepUpSmsSendResponse,
} from "@/features/account/mfa/types/step-up-types";

export async function fetchStepUpOptions() {
  return apiRequest<StepUpOptions>("/auth/step-up/options");
}

export async function sendStepUpSms() {
  return apiRequest<StepUpSmsSendResponse>("/auth/step-up/send-sms", {
    method: "POST",
  });
}
