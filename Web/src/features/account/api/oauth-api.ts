import { apiRequest } from "@/lib/api-client";
import type {
  AppleLoginProfile,
  OAuthConnections,
} from "@/features/auth/api/types";

export async function fetchOAuthConnections() {
  return apiRequest<OAuthConnections>("/auth/oauth/connections");
}

export async function connectOAuthGoogle(idToken: string) {
  return apiRequest<OAuthConnections>("/auth/oauth/connect/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}

export async function connectOAuthApple(idToken: string, profile?: AppleLoginProfile) {
  return apiRequest<OAuthConnections>("/auth/oauth/connect/apple", {
    method: "POST",
    body: JSON.stringify({
      id_token: idToken,
      user_email: profile?.userEmail ?? null,
      first_name: profile?.firstName ?? null,
      last_name: profile?.lastName ?? null,
    }),
  });
}

export async function disconnectOAuth(payload: {
  provider: "google" | "apple";
  currentPassword: string;
  totpCode?: string;
}) {
  return apiRequest<OAuthConnections>("/auth/oauth/disconnect", {
    method: "POST",
    body: JSON.stringify({
      provider: payload.provider,
      current_password: payload.currentPassword,
      totp_code: payload.totpCode ?? null,
    }),
  });
}
