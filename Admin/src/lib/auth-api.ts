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

function assertAdminUser(user: AdminUser) {
  if (user.role !== "admin") {
    throw new Error("This account does not have admin access.");
  }
}

export async function bootstrapAdminSession() {
  const result = await refreshSession();
  if (!result.ok) {
    return { user: null as AdminUser | null, permissions: [] as string[], reason: result.reason };
  }

  try {
    const [user, permissions] = await Promise.all([
      apiRequest<AdminUser>("/auth/me"),
      apiRequest<{ permissions: string[] }>("/admin/rbac/me"),
    ]);
    assertAdminUser(user);
    return { user, permissions: permissions.permissions, reason: null };
  } catch {
    setAccessToken(null);
    return { user: null, permissions: [], reason: "expired" as const };
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
  return result;
}

export async function adminLogout() {
  await apiRequest("/auth/logout", { method: "POST" });
  setAccessToken(null);
}

export async function fetchAdminPermissions() {
  const result = await apiRequest<{ permissions: string[] }>("/admin/rbac/me");
  return result.permissions;
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
  const result = await apiRequest<AuthSuccessResponse>("/auth/admin-invite/accept", {
    method: "POST",
    body: JSON.stringify({
      token: payload.token,
      first_name: payload.first_name,
      last_name: payload.last_name ?? null,
      password: payload.password,
      device_fingerprint: "admin-console",
    }),
  });
  assertAdminUser(result.user);
  setAccessToken(result.access_token);
  return result;
}
