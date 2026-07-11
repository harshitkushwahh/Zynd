import { apiRequest } from "@/lib/api-client";
import type { OtpSendResponse } from "@/features/auth/api/types";
import type { PinVerifyResponse } from "@/features/account/pin/api/pin-api";

export type { PinVerifyResponse };

export type PinOkResponse = {
  ok: boolean;
  pin_enrolled: boolean;
};

export type PinBiometricCredential = {
  id: string;
  credential_id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type PinBiometricStatusResponse = {
  enrolled: boolean;
  credentials: PinBiometricCredential[];
};

export type PinBiometricRegisterVerifyResponse = {
  ok: boolean;
  credential_id: string;
  id: string;
  device_name: string | null;
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

export async function fetchPinBiometricStatus() {
  return apiRequest<PinBiometricStatusResponse>("/auth/pin/biometric/status");
}

export async function fetchPinBiometricRegisterOptions() {
  return apiRequest<{ challenge_token: string; options: PublicKeyCredentialCreationOptionsJSON }>(
    "/auth/pin/biometric/register/options",
    { method: "POST" }
  );
}

export async function verifyPinBiometricRegister(payload: {
  challengeToken: string;
  credential: RegistrationResponseJSON;
  deviceName?: string;
}) {
  return apiRequest<PinBiometricRegisterVerifyResponse>("/auth/pin/biometric/register/verify", {
    method: "POST",
    body: JSON.stringify({
      challenge_token: payload.challengeToken,
      credential: payload.credential,
      device_name: payload.deviceName,
    }),
  });
}

export async function fetchPinBiometricUnlockOptions(credentialId?: string) {
  return apiRequest<{ challenge_token: string; options: PublicKeyCredentialRequestOptionsJSON }>(
    "/auth/pin/biometric/unlock/options",
    {
      method: "POST",
      body: JSON.stringify({ credential_id: credentialId ?? null }),
    }
  );
}

export async function verifyPinBiometricUnlock(payload: {
  challengeToken: string;
  credential: AuthenticationResponseJSON;
}) {
  return apiRequest<PinVerifyResponse>("/auth/pin/biometric/unlock/verify", {
    method: "POST",
    body: JSON.stringify({
      challenge_token: payload.challengeToken,
      credential: payload.credential,
    }),
  });
}

export async function deletePinBiometricCredential(credentialRecordId: string) {
  return apiRequest<{ ok: boolean }>(`/auth/pin/biometric/credentials/${credentialRecordId}`, {
    method: "DELETE",
  });
}
