export type StepUpVerification = {
  totpCode?: string;
  smsOtp?: string;
};

export type StepUpOptions = {
  sms_fallback_available: boolean;
  masked_phone: string | null;
};

export type StepUpSmsSendResponse = {
  ok: boolean;
  retry_after_seconds: number;
  expires_in: number;
  masked_phone: string;
};
