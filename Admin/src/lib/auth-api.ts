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
