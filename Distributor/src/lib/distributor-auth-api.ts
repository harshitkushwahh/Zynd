import { apiRequest, refreshSession, setAccessToken } from "@/lib/api-client";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export type DistributorBackendUser = {
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
  user: DistributorBackendUser;
};

type MfaRequiredResponse = {
  next: "mfa_required";
  mfa_token: string;
  expires_in: number;
};

export type DistributorLoginFlowResponse = AuthSuccessResponse | MfaRequiredResponse;

export function isAuthenticatedResponse(
  result: DistributorLoginFlowResponse
): result is AuthSuccessResponse {
  return result.next === "authenticated";
}

export function getDisplayName(user: DistributorBackendUser) {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email.split("@")[0];
}

export async function loginDistributor(email: string, password: string) {
  const result = await apiRequest<DistributorLoginFlowResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      device_fingerprint: "admin-console",
    }),
  });

  if (!isAuthenticatedResponse(result)) {
    throw new Error("Multi-factor authentication is required for this account.");
  }

  if (result.user.role !== "admin") {
    setAccessToken(null);
    throw new Error(ZYND_MITRA_COPY.noConsoleAccess);
  }

  setAccessToken(result.access_token);
  return result.user;
}

export async function bootstrapDistributorSession() {
  const result = await refreshSession();
  if (!result.ok) {
    return { user: null as DistributorBackendUser | null, reason: result.reason };
  }

  try {
    const me = await apiRequest<DistributorBackendUser>("/auth/me");
    if (me.role !== "admin") {
      setAccessToken(null);
      return { user: null, reason: "expired" as const };
    }
    return { user: me, reason: null };
  } catch {
    setAccessToken(null);
    return { user: null, reason: "expired" as const };
  }
}

export function signOutDistributor() {
  setAccessToken(null);
}
