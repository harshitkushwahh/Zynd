import { apiRequest, refreshSession, setAccessToken, isAuthFailure } from "@/lib/api-client";
import {
  mapPersonaToSessionRole,
  resolveDistributorConsolePersona,
  type DistributorConsolePersona,
} from "@/lib/distributor-console-access";
import type { DistributorSessionUser } from "@/lib/distributor-session-types";
import {
  fetchDistributorConsoleContext,
  type DistributorConsoleContext,
} from "@/lib/distributor-partners-api";
import { readPersistedDistributorSession, clearPersistedDistributorSession } from "@/lib/distributor-session-storage";
import { resolveDistributorAssetUrl } from "@/lib/distributor-asset-url";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export const DISTRIBUTOR_DEVICE_FINGERPRINT = "distributor-console";

export type DistributorBackendUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  client_id: string;
  mfa_enrolled: boolean;
  pin_enrolled: boolean;
  created_at: string;
  profile_image_url?: string | null;
};

type AuthSuccessResponse = {
  next: "authenticated";
  access_token: string;
  user: DistributorBackendUser;
};

type MfaRequiredResponse = {
  next: "mfa_required";
  mfa_token: string;
  expires_in: number;
  sms_fallback_available?: boolean;
  masked_phone?: string | null;
};

type SmsOtpRequiredResponse = {
  next: "sms_otp_required";
  login_token: string;
  masked_phone: string;
  expires_in: number;
  retry_after_seconds: number;
};

export type DistributorLoginFlowResponse =
  | AuthSuccessResponse
  | MfaRequiredResponse
  | SmsOtpRequiredResponse;

export type DistributorRbacSnapshot = {
  permissions: string[];
  roleKeys: string[];
};

export function isAuthenticatedResponse(
  result: DistributorLoginFlowResponse,
): result is AuthSuccessResponse {
  return result.next === "authenticated";
}

export function isMfaRequiredResponse(
  result: DistributorLoginFlowResponse,
): result is MfaRequiredResponse {
  return result.next === "mfa_required";
}

export function isSmsOtpRequiredResponse(
  result: DistributorLoginFlowResponse,
): result is SmsOtpRequiredResponse {
  return result.next === "sms_otp_required";
}

export function getDisplayName(user: DistributorBackendUser) {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email.split("@")[0];
}

function assertAdminPlatformUser(user: DistributorBackendUser) {
  if (user.role !== "admin") {
    throw new Error(ZYND_MITRA_COPY.noConsoleAccess);
  }
}

function assertDistributorConsoleAccess(roleKeys: string[]): DistributorConsolePersona {
  const persona = resolveDistributorConsolePersona(roleKeys);
  if (!persona) {
    throw new Error(ZYND_MITRA_COPY.noConsoleAccess);
  }
  return persona;
}

export function toDistributorSessionUser(
  apiUser: DistributorBackendUser,
  persona: DistributorConsolePersona,
  context?: DistributorConsoleContext | null,
): DistributorSessionUser {
  const name = getDisplayName(apiUser);
  return {
    id: apiUser.id,
    email: apiUser.email,
    name,
    role: mapPersonaToSessionRole(persona),
    initials: name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    authMode: "api",
    pinEnrolled: apiUser.pin_enrolled,
    mfaEnrolled: apiUser.mfa_enrolled,
    joinedAt: apiUser.created_at,
    zyndClientId: context?.client_id ?? apiUser.client_id,
    phoneMasked: context?.phone_masked ?? "",
    branchId: context?.branch?.id,
    branchName: context?.branch?.name,
    branchCode: context?.branch?.id,
    avatarUrl: resolveDistributorAssetUrl(apiUser.profile_image_url),
  };
}

async function fetchDistributorConsoleContextSafe(): Promise<DistributorConsoleContext | null> {
  try {
    return await fetchDistributorConsoleContext();
  } catch {
    return null;
  }
}

async function fetchDistributorRbacSnapshot(): Promise<DistributorRbacSnapshot> {
  const result = await apiRequest<{ permissions: string[]; role_keys: string[] }>(
    "/admin/rbac/me",
  );
  return {
    permissions: result.permissions,
    roleKeys: result.role_keys,
  };
}

async function completeAuthenticatedSession(user: DistributorBackendUser) {
  assertAdminPlatformUser(user);
  const rbac = await fetchDistributorRbacSnapshot();
  const persona = assertDistributorConsoleAccess(rbac.roleKeys);
  const context = await fetchDistributorConsoleContextSafe();
  return {
    user,
    persona,
    sessionUser: toDistributorSessionUser(user, persona, context),
    permissions: rbac.permissions,
    roleKeys: rbac.roleKeys,
  };
}

export async function distributorLogin(
  email: string,
  password: string,
): Promise<DistributorLoginFlowResponse> {
  const result = await apiRequest<DistributorLoginFlowResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      device_fingerprint: DISTRIBUTOR_DEVICE_FINGERPRINT,
    }),
  });

  if (isAuthenticatedResponse(result)) {
    setAccessToken(result.access_token);
    try {
      await completeAuthenticatedSession(result.user);
    } catch (error) {
      setAccessToken(null);
      throw error;
    }
  }

  return result;
}

export async function completeDistributorLogin(user: DistributorBackendUser) {
  return completeAuthenticatedSession(user);
}

export async function distributorVerifyMfa(
  mfaToken: string,
  totpCode: string,
): Promise<DistributorSessionUser> {
  const result = await apiRequest<AuthSuccessResponse>("/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({
      mfa_token: mfaToken,
      totp_code: totpCode,
      backup_code: null,
      sms_otp: null,
    }),
  });
  setAccessToken(result.access_token);
  const session = await completeAuthenticatedSession(result.user);
  return session.sessionUser;
}

export async function distributorVerifyLoginSms(
  loginToken: string,
  otp: string,
): Promise<DistributorSessionUser> {
  const result = await apiRequest<AuthSuccessResponse>("/auth/login/verify-sms", {
    method: "POST",
    body: JSON.stringify({
      login_token: loginToken,
      otp,
    }),
  });
  setAccessToken(result.access_token);
  const session = await completeAuthenticatedSession(result.user);
  return session.sessionUser;
}

export async function resendDistributorLoginSms(loginToken: string) {
  return apiRequest<{ ok: boolean; retry_after_seconds: number; expires_in: number }>(
    "/auth/login/resend-sms",
    {
      method: "POST",
      body: JSON.stringify({ login_token: loginToken }),
    },
  );
}

export async function bootstrapDistributorSession() {
  const result = await refreshSession();
  if (!result.ok) {
    return {
      sessionUser: null as DistributorSessionUser | null,
      permissions: [] as string[],
      roleKeys: [] as string[],
      reason: result.reason,
      tokenRefreshed: false,
    };
  }

  const cachedUser = readPersistedDistributorSession();

  try {
    const me = await apiRequest<DistributorBackendUser>("/auth/me");
    if (cachedUser && cachedUser.id !== me.id) {
      clearPersistedDistributorSession();
    }

    try {
      const session = await completeAuthenticatedSession(me);
      return {
        sessionUser: session.sessionUser,
        permissions: session.permissions,
        roleKeys: session.roleKeys,
        reason: null,
        tokenRefreshed: true,
      };
    } catch (enrichError) {
      if (isAuthFailure(enrichError)) {
        throw enrichError;
      }

      if (cachedUser?.id === me.id) {
        return {
          sessionUser: {
            ...cachedUser,
            email: me.email,
            pinEnrolled: me.pin_enrolled,
            mfaEnrolled: me.mfa_enrolled,
            avatarUrl: resolveDistributorAssetUrl(me.profile_image_url) ?? cachedUser.avatarUrl ?? null,
          },
          permissions: [],
          roleKeys: [],
          reason: null,
          tokenRefreshed: true,
        };
      }

      throw enrichError;
    }
  } catch (error) {
    if (isAuthFailure(error)) {
      setAccessToken(null);
      return {
        sessionUser: null,
        permissions: [],
        roleKeys: [],
        reason: "expired" as const,
        tokenRefreshed: false,
      };
    }

    return {
      sessionUser: null,
      permissions: [],
      roleKeys: [],
      reason: "network" as const,
      tokenRefreshed: true,
    };
  }
}

export async function fetchDistributorBackendUser() {
  return apiRequest<DistributorBackendUser>("/auth/me");
}

export async function distributorLogout() {
  await apiRequest("/auth/logout", { method: "POST" });
  setAccessToken(null);
}

export async function fetchDistributorPermissions() {
  const rbac = await fetchDistributorRbacSnapshot();
  return rbac.permissions;
}

export async function refreshDistributorSessionUser() {
  const me = await apiRequest<DistributorBackendUser>("/auth/me");
  return completeAuthenticatedSession(me);
}
