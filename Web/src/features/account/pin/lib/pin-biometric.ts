import {
  fetchPinBiometricRegisterOptions,
  fetchPinBiometricUnlockOptions,
  verifyPinBiometricRegister,
  verifyPinBiometricUnlock,
} from "@/features/account/pin/api/pin-api";
import {
  clearLocalPinBiometricCredentialId,
  saveLocalPinBiometricCredentialId,
} from "@/features/account/pin/storage/pin-biometric-storage";

function base64URLToArrayBuffer(value: string): ArrayBuffer {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    view[i] = raw.charCodeAt(i);
  }
  return buffer;
}

function arrayBufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function prepareCreationOptions(
  options: PublicKeyCredentialCreationOptionsJSON
): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64URLToArrayBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64URLToArrayBuffer(options.user.id),
    },
    excludeCredentials: options.excludeCredentials?.map((credential) => ({
      ...credential,
      id: base64URLToArrayBuffer(credential.id),
    })),
  };
}

function prepareRequestOptions(
  options: PublicKeyCredentialRequestOptionsJSON
): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64URLToArrayBuffer(options.challenge),
    allowCredentials: options.allowCredentials?.map((credential) => ({
      ...credential,
      id: base64URLToArrayBuffer(credential.id),
    })),
  };
}

function attestationToJson(credential: PublicKeyCredential): RegistrationResponseJSON {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64URL(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
      attestationObject: arrayBufferToBase64URL(response.attestationObject),
      transports: response.getTransports?.(),
    },
  };
}

function assertionToJson(credential: PublicKeyCredential): AuthenticationResponseJSON {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64URL(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
      authenticatorData: arrayBufferToBase64URL(response.authenticatorData),
      signature: arrayBufferToBase64URL(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64URL(response.userHandle) : undefined,
    },
  };
}

export async function isPlatformBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function detectBiometricDeviceName(): string {
  if (typeof navigator === "undefined") return "This device";
  const platform = navigator.platform || "";
  const ua = navigator.userAgent || "";
  if (/Mac/i.test(platform) || /Mac OS/i.test(ua)) return "Mac";
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "Windows PC";
  if (/iPhone|iPad/i.test(ua)) return "iPhone or iPad";
  if (/Android/i.test(ua)) return "Android device";
  return "This device";
}

export async function registerPinBiometricUnlock(userId: string) {
  const { challenge_token, options } = await fetchPinBiometricRegisterOptions();
  const credential = (await navigator.credentials.create({
    publicKey: prepareCreationOptions(options),
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Biometric registration was cancelled.");
  }

  const result = await verifyPinBiometricRegister({
    challengeToken: challenge_token,
    credential: attestationToJson(credential),
    deviceName: detectBiometricDeviceName(),
  });
  saveLocalPinBiometricCredentialId(userId, result.credential_id);
  return result;
}

export async function unlockWithPinBiometric(credentialId?: string | null) {
  const { challenge_token, options } = await fetchPinBiometricUnlockOptions(credentialId ?? undefined);
  const credential = (await navigator.credentials.get({
    publicKey: prepareRequestOptions(options),
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Biometric unlock was cancelled.");
  }

  return verifyPinBiometricUnlock({
    challengeToken: challenge_token,
    credential: assertionToJson(credential),
  });
}

export function clearPinBiometricEnrollment(userId: string) {
  clearLocalPinBiometricCredentialId(userId);
}
