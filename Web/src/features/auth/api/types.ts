export type AuthUser = {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  role: string;
  country_code: string;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  mfa_enrolled: boolean;
  mfa_enrolled_at: string | null;
  pin_enrolled: boolean;
  pin_set_at: string | null;
  fund_movement_eligible: boolean;
  account_status: string;
  deletion_scheduled_at: string | null;
  client_id: string;
};

export type AuthSuccessResponse = {
  next: "authenticated";
  access_token: string;
  token_type: string;
  user: AuthUser;
  new_device?: boolean;
  velocity_flagged?: boolean;
};

export type MfaRequiredResponse = {
  next: "mfa_required";
  mfa_token: string;
  expires_in: number;
  sms_fallback_available?: boolean;
  masked_phone?: string | null;
};

export type SmsOtpRequiredResponse = {
  next: "sms_otp_required";
  login_token: string;
  masked_phone: string;
  expires_in: number;
  retry_after_seconds?: number;
};

export type StepUpRequiredResponse = {
  next: "step_up_required";
  step_up_token: string;
  expires_in: number;
  methods: Array<"totp" | "sms">;
};

export type OAuthLinkRequiredResponse = {
  next: "oauth_link_confirmation_required";
  link_token: string;
  expires_in: number;
  email_hint: string;
  provider: "google" | "apple";
  retry_after_seconds?: number;
};

export type LoginFlowResponse =
  | AuthSuccessResponse
  | MfaRequiredResponse
  | SmsOtpRequiredResponse
  | StepUpRequiredResponse
  | OAuthLinkRequiredResponse;

export type AuthSecurityPolicy = {
  login_sms_otp_when_mfa_disabled: boolean;
  step_up_sms_fallback_enabled: boolean;
  fund_require_mfa: boolean;
  fund_require_pin: boolean;
  mfa_enrolled: boolean;
  pin_enrolled: boolean;
  phone_verified: boolean;
};

export type OtpSendResponse = {
  ok: boolean;
  retry_after_seconds: number;
  expires_in: number;
};

export type SignupStartResponse = {
  next: "signup" | "login";
  signup_token?: string;
  retry_after_seconds: number;
  expires_in: number;
  message?: string;
};

export type AppleLoginProfile = {
  userEmail?: string;
  firstName?: string;
  lastName?: string;
};

export type OAuthProviderStatus = {
  connected: boolean;
  email: string | null;
};

export type OAuthConnections = {
  google: OAuthProviderStatus;
  apple: OAuthProviderStatus;
};

export type UserSession = {
  id: string;
  is_current: boolean;
  os: string | null;
  browser: string | null;
  last_used_at: string;
  created_at: string;
};

export function isAuthenticatedResponse(
  response: LoginFlowResponse
): response is AuthSuccessResponse {
  return response.next === "authenticated";
}
