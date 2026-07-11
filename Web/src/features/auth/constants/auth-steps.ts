import type { SignupStepId } from "@/components/auth/auth-shared";
import { copy } from "@/shared/config/copy";

export type AuthStep =
  | "email"
  | "login"
  | "mfa-challenge"
  | "oauth-link"
  | "email-otp"
  | "password"
  | "mobile"
  | "mobile-otp"
  | "profile"
  | "forgot-password";

export const AUTH_STEP_COPY: Record<AuthStep, { title: string; description: string }> = {
  email: {
    title: copy.auth.welcomeTitle,
    description: copy.auth.welcomeDescription,
  },
  login: {
    title: copy.auth.loginTitle,
    description: copy.auth.loginDescription,
  },
  "mfa-challenge": copy.authSteps.mfaChallenge,
  "oauth-link": copy.authSteps.oauthLink,
  "email-otp": copy.authSteps.emailOtp,
  password: copy.authSteps.password,
  mobile: copy.authSteps.mobile,
  "mobile-otp": copy.authSteps.mobileOtp,
  profile: copy.authSteps.profile,
  "forgot-password": copy.authSteps.forgotPassword,
};

export function getAuthProgressStep(step: AuthStep): SignupStepId | null {
  if (
    step === "email" ||
    step === "login" ||
    step === "forgot-password" ||
    step === "mfa-challenge" ||
    step === "oauth-link"
  ) {
    return null;
  }
  return step as SignupStepId;
}

export function getOAuthProviderLabel(provider: "google" | "apple" | string) {
  return provider === "apple" ? "Apple" : "Google";
}
