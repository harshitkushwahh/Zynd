import { apiRequest } from "@/lib/api-client";

export type PinVerifyResponse = {
  unlocked: boolean;
  expires_in: number;
};

export type PinOkResponse = {
  ok: boolean;
  pin_enrolled: boolean;
};

type OtpSendResponse = {
  ok: boolean;
  retry_after_seconds: number;
  expires_in: number;
};

export async function setupZyndPin(payload: {
  currentPassword: string;
  totpCode: string;
  pin: string;
  confirmPin: string;
}) {
  return apiRequest<PinOkResponse>("/auth/pin/setup", {
    method: "POST",
    body: JSON.stringify({
      current_password: payload.currentPassword,
      totp_code: payload.totpCode,
      pin: payload.pin,
      confirm_pin: payload.confirmPin,
    }),
  });
}

export async function verifyZyndPin(pin: string) {
  return apiRequest<PinVerifyResponse>("/auth/pin/verify", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export async function sendZyndPinResetOtp() {
  return apiRequest<OtpSendResponse>("/auth/pin/forgot/send-otp", {
    method: "POST",
  });
}

export async function resetZyndPinWithOtp(payload: {
  otp: string;
  pin: string;
  confirmPin: string;
}) {
  return apiRequest<PinOkResponse>("/auth/pin/forgot/reset", {
    method: "POST",
    body: JSON.stringify({
      otp: payload.otp,
      pin: payload.pin,
      confirm_pin: payload.confirmPin,
    }),
  });
}
