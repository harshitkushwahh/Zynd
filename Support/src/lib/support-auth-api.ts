import { apiRequest, refreshSession, setAccessToken, isAuthFailure } from "@/lib/api-client";
import {
  hasSupportConsoleAccess,
  resolvePrimarySupportRoleKey,
} from "@/lib/support-console-roles";

export const SUPPORT_DEVICE_FINGERPRINT = "support-console";

const NO_CONSOLE_ACCESS =
  "This account does not have access to the Zynd Support console.";

export type SupportBackendUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  mfa_enrolled: boolean;
  pin_enrolled: boolean;
  created_at?: string;
};

export type SupportSessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  initials: string;
};

type AuthSuccessResponse = {
  next: "authenticated";
  access_token: string;
  user: SupportBackendUser;
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

export type SupportLoginFlowResponse =
  | AuthSuccessResponse
  | MfaRequiredResponse
  | SmsOtpRequiredResponse;

export function isAuthenticatedResponse(
  result: SupportLoginFlowResponse,
): result is AuthSuccessResponse {
  return result.next === "authenticated";
}

export function isMfaRequiredResponse(
  result: SupportLoginFlowResponse,
): result is MfaRequiredResponse {
  return result.next === "mfa_required";
}

export function isSmsOtpRequiredResponse(
  result: SupportLoginFlowResponse,
): result is SmsOtpRequiredResponse {
  return result.next === "sms_otp_required";
}

export function getDisplayName(user: SupportBackendUser) {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email.split("@")[0];
}

function toSessionUser(user: SupportBackendUser, roleKey: string): SupportSessionUser {
  const name = getDisplayName(user);
  return {
    id: user.id,
    email: user.email,
    name,
    role: roleKey,
    initials: name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  };
}

async function fetchSupportRbacSnapshot() {
  const result = await apiRequest<{ permissions: string[]; role_keys: string[] }>(
    "/admin/rbac/me",
  );
  return {
    permissions: result.permissions,
    roleKeys: result.role_keys,
  };
}

async function completeAuthenticatedSession(user: SupportBackendUser) {
  if (user.role !== "admin") {
    throw new Error(NO_CONSOLE_ACCESS);
  }
  const rbac = await fetchSupportRbacSnapshot();
  if (!hasSupportConsoleAccess(rbac.roleKeys)) {
    throw new Error(NO_CONSOLE_ACCESS);
  }
  const roleKey = resolvePrimarySupportRoleKey(rbac.roleKeys);
  return {
    sessionUser: toSessionUser(user, roleKey),
    permissions: rbac.permissions,
    roleKeys: rbac.roleKeys,
  };
}

export async function supportLogin(
  email: string,
  password: string,
): Promise<SupportLoginFlowResponse> {
  const result = await apiRequest<SupportLoginFlowResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      device_fingerprint: SUPPORT_DEVICE_FINGERPRINT,
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

export async function completeSupportLogin(user: SupportBackendUser) {
  return completeAuthenticatedSession(user);
}

export async function supportVerifyMfa(mfaToken: string, totpCode: string) {
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

export async function supportVerifyLoginSms(loginToken: string, otp: string) {
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

export async function resendSupportLoginSms(loginToken: string) {
  const result = await apiRequest<{ ok: boolean; retry_after_seconds: number }>(
    "/auth/login/resend-sms",
    {
      method: "POST",
      body: JSON.stringify({ login_token: loginToken }),
    },
  );
  return result.retry_after_seconds ?? 30;
}

export async function bootstrapSupportSession() {
  const result = await refreshSession();
  if (!result.ok) {
    return {
      sessionUser: null as SupportSessionUser | null,
      permissions: [] as string[],
      roleKeys: [] as string[],
      reason: result.reason,
    };
  }

  try {
    const me = await apiRequest<SupportBackendUser>("/auth/me");
    const session = await completeAuthenticatedSession(me);
    return {
      sessionUser: session.sessionUser,
      permissions: session.permissions,
      roleKeys: session.roleKeys,
      reason: null,
    };
  } catch (error) {
    if (isAuthFailure(error)) {
      setAccessToken(null);
      return {
        sessionUser: null,
        permissions: [],
        roleKeys: [],
        reason: "expired" as const,
      };
    }
    return {
      sessionUser: null,
      permissions: [],
      roleKeys: [],
      reason: "network" as const,
    };
  }
}

export async function supportLogout() {
  await apiRequest("/auth/logout", { method: "POST" });
  setAccessToken(null);
}
