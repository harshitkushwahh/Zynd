import { apiRequest, refreshSession, setAccessToken } from "@/lib/api-client";

export type AdminUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  mfa_enrolled: boolean;
  pin_enrolled: boolean;
};

type AuthSuccessResponse = {
  next: "authenticated";
  access_token: string;
  user: AdminUser;
};

type MfaRequiredResponse = {
  next: "mfa_required";
  mfa_token: string;
  expires_in: number;
};

export type AdminLoginFlowResponse = AuthSuccessResponse | MfaRequiredResponse;

export function isAuthenticatedResponse(
  result: AdminLoginFlowResponse
): result is AuthSuccessResponse {
  return result.next === "authenticated";
}

export function getDisplayName(user: AdminUser) {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email.split("@")[0];
}

import { isDistributorConsoleOnlyUser } from "@/lib/admin-mitra-roles";

const ADMIN_CONSOLE_ACCESS_ERROR =
  "This account is for the Zynd Mitra console. Sign in at the distributor dashboard.";

function assertAdminUser(user: AdminUser) {
  if (user.role !== "admin") {
    throw new Error("This account does not have admin access.");
  }
}

function assertAdminConsoleAccess(roleKeys: string[]) {
  if (isDistributorConsoleOnlyUser(roleKeys)) {
    throw new Error(ADMIN_CONSOLE_ACCESS_ERROR);
  }
}

export async function bootstrapAdminSession() {
  const result = await refreshSession();
  if (!result.ok) {
    return { user: null as AdminUser | null, permissions: [] as string[], roleKeys: [] as string[], soleSuperAdmin: false, reason: result.reason };
  }

  try {
    const [user, rbac] = await Promise.all([
      apiRequest<AdminUser>("/auth/me"),
      fetchAdminRbacMe(),
    ]);
    assertAdminUser(user);
    assertAdminConsoleAccess(rbac.role_keys);
    return { user, permissions: rbac.permissions, roleKeys: rbac.role_keys, soleSuperAdmin: rbac.sole_super_admin ?? false, reason: null };
  } catch {
    setAccessToken(null);
    return { user: null, permissions: [], roleKeys: [] as string[], soleSuperAdmin: false, reason: "expired" as const };
  }
}

export async function adminLogin(
  email: string,
  password: string,
  turnstileToken?: string | null
): Promise<AdminLoginFlowResponse> {
  const result = await apiRequest<AdminLoginFlowResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      device_fingerprint: "admin-console",
      turnstile_token: turnstileToken ?? null,
    }),
  });

  if (isAuthenticatedResponse(result)) {
    assertAdminUser(result.user);
    setAccessToken(result.access_token);
    try {
      const rbac = await fetchAdminRbacMe();
      assertAdminConsoleAccess(rbac.role_keys);
    } catch (error) {
      setAccessToken(null);
      throw error;
    }
  }

  return result;
}

export async function adminVerifyMfa(
  mfaToken: string,
  totpCode: string
): Promise<AuthSuccessResponse> {
  const result = await apiRequest<AuthSuccessResponse>("/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({
      mfa_token: mfaToken,
      totp_code: totpCode,
    }),
  });
  assertAdminUser(result.user);
  setAccessToken(result.access_token);
  try {
    const rbac = await fetchAdminRbacMe();
    assertAdminConsoleAccess(rbac.role_keys);
  } catch (error) {
    setAccessToken(null);
    throw error;
  }
  return result;
}

export async function adminLogout() {
  await apiRequest("/auth/logout", { method: "POST" });
  setAccessToken(null);
}

export type AdminRbacMe = {
  permissions: string[];
  role_keys: string[];
  sole_super_admin?: boolean;
};

export async function fetchAdminRbacMe(): Promise<AdminRbacMe> {
  return apiRequest<AdminRbacMe>("/admin/rbac/me");
}

export async function fetchAdminPermissions() {
  const result = await fetchAdminRbacMe();
  return result.permissions;
}

export async function fetchAdminRoleKeys() {
  const result = await fetchAdminRbacMe();
  return result.role_keys;
}

export async function fetchCurrentAdminUser() {
  const user = await apiRequest<AdminUser>("/auth/me");
  assertAdminUser(user);
  return user;
}

export type AdminInvitePreview = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_key: string;
  role_name: string | null;
  inviter_name: string | null;
  expires_at: string;
  target_console: "admin" | "distributor";
};

export async function validateAdminInvite(token: string) {
  const params = new URLSearchParams({ token });
  return apiRequest<AdminInvitePreview>(`/auth/admin-invite/validate?${params.toString()}`);
}

export async function acceptAdminInvite(payload: {
  token: string;
  first_name: string;
  last_name?: string;
  password: string;
}) {
  return apiRequest<{
    next: "onboarding";
    onboarding_token: string;
    expires_in: number;
  }>("/auth/admin-invite/accept", {
    method: "POST",
    body: JSON.stringify({
      token: payload.token,
      first_name: payload.first_name,
      last_name: payload.last_name ?? null,
      password: payload.password,
      device_fingerprint: "admin-console",
    }),
  });
}

export async function adminInviteMfaStart(onboardingToken: string) {
  return apiRequest<{
    enroll_token: string;
    qr_uri: string;
    manual_secret: string;
    expires_in: number;
  }>("/auth/admin-invite/mfa/start", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function adminInviteMfaConfirm(
  onboardingToken: string,
  enrollToken: string,
  totpCode: string,
) {
  return apiRequest<{
    enrolled: boolean;
    backup_codes: string[];
  }>("/auth/admin-invite/mfa/confirm", {
    method: "POST",
    body: JSON.stringify({
      onboarding_token: onboardingToken,
      enroll_token: enrollToken,
      totp_code: totpCode,
    }),
  });
}

export async function completeAdminInvite(payload: {
  onboardingToken: string;
  pin: string;
  confirmPin: string;
  totpCode: string;
}) {
  const result = await apiRequest<AuthSuccessResponse>("/auth/admin-invite/complete", {
    method: "POST",
    body: JSON.stringify({
      onboarding_token: payload.onboardingToken,
      pin: payload.pin,
      confirm_pin: payload.confirmPin,
      totp_code: payload.totpCode,
      device_fingerprint: "admin-console",
    }),
  });
  assertAdminUser(result.user);
  setAccessToken(result.access_token);
  return result;
}
