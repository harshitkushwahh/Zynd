"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type { SignupStepId } from "@/components/auth/auth-shared";
import { isTurnstileRequired } from "@/components/auth/turnstile-widget";
import { useOtpResendCooldown } from "@/hooks/use-otp-resend-cooldown";
import { useAuth } from "@/contexts/auth-context";
import { useKycOptional } from "@/contexts/kyc-context";
import { ApiError } from "@/lib/api-client";
import {
  DEFAULT_COUNTRY,
  isValidEmail,
  isValidMobile,
  isValidOtp,
  validateProfile,
} from "@/lib/auth-validation";
import { env } from "@/lib/env";
import { ensureAppleScript, ensureGoogleScript, requestAppleIdToken, requestGoogleIdToken } from "@/lib/oauth-client";
import { isPasswordValid } from "@/lib/password-criteria";
import {
  forgotPassword,
  confirmOAuthLink,
  isAuthenticatedResponse,
  resendOAuthLinkOtp,
  signupComplete,
  signupResendEmailOtp,
  signupSendMobileOtp,
  signupSetPassword,
  signupStart,
  signupVerifyEmail,
  signupVerifyMobile,
  verifyMfaLogin,
} from "@/lib/auth-api";
import {
  AUTH_STEP_COPY,
  getAuthProgressStep,
  getOAuthProviderLabel,
  type AuthStep,
} from "@/features/auth/constants/auth-steps";
import { getAuthErrorMessage, syncOtpCooldownFromError } from "@/features/auth/utils/auth-errors";
import {
  clearTurnstileSession,
  readTurnstileSession,
  writeTurnstileSession,
} from "@/lib/turnstile-session";
import { copy } from "@/shared/config/copy";
import { storageKeys } from "@/shared/config/storage-keys";
import { clearReferralCode, normalizeReferralCode, persistReferralCode, readReferralCode } from "@/features/referral/lib/referral-storage";

type AuthDialogFlowContextValue = ReturnType<typeof useAuthDialogFlowState>;

const AuthDialogFlowContext = createContext<AuthDialogFlowContextValue | null>(null);

function useAuthDialogFlowState(onClose: () => void) {
  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithApple, setUser, completeAuth } = useAuth();
  const kyc = useKycOptional();

  const [step, setStep] = useState<AuthStep>("email");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupToken, setSignupToken] = useState("");

  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  const [emailError, setEmailError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailOtpError, setEmailOtpError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [mobileOtpError, setMobileOtpError] = useState("");
  const [profileErrors, setProfileErrors] = useState<
    Partial<Record<"firstName" | "middleName" | "lastName", string>>
  >({});

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [showReferralCodeInput, setShowReferralCodeInput] = useState(false);
  const [referralCodeError, setReferralCodeError] = useState("");
  const [turnstileToken, setTurnstileTokenState] = useState(() => readTurnstileSession() ?? "");
  const [turnstileError, setTurnstileError] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loginCaptchaRequired, setLoginCaptchaRequired] = useState(false);

  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [mfaError, setMfaError] = useState("");

  const [linkToken, setLinkToken] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [oauthLinkProvider, setOauthLinkProvider] = useState<"google" | "apple">("google");
  const [oauthLinkOtp, setOauthLinkOtp] = useState("");
  const [oauthLinkPassword, setOauthLinkPassword] = useState("");
  const [oauthLinkError, setOauthLinkError] = useState("");

  const emailOtpCooldown = useOtpResendCooldown(storageKeys.signupEmailOtpCooldown);
  const mobileOtpCooldown = useOtpResendCooldown(storageKeys.signupMobileOtpCooldown);
  const oauthLinkCooldown = useOtpResendCooldown(storageKeys.oauthLinkOtpCooldown);

  const setTurnstileToken = useCallback((token: string) => {
    setTurnstileTokenState(token);
    if (token) {
      writeTurnstileSession(token);
    } else {
      clearTurnstileSession();
    }
  }, []);

  const consumeTurnstileToken = useCallback(() => {
    clearTurnstileSession();
    setTurnstileTokenState("");
  }, []);

  const resetTurnstile = useCallback(() => {
    clearTurnstileSession();
    setTurnstileTokenState("");
    setTurnstileError("");
    setTurnstileResetKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (env.googleClientId) {
      void ensureGoogleScript().catch(() => undefined);
    }
    if (env.appleClientId) {
      void ensureAppleScript().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const storedReferralCode = readReferralCode();
    if (storedReferralCode) {
      setReferralCodeInput(storedReferralCode);
      setShowReferralCodeInput(true);
    }
  }, []);

  const commitReferralCodeInput = useCallback((): boolean => {
    const trimmed = referralCodeInput.trim();
    if (!trimmed) {
      if (showReferralCodeInput) {
        clearReferralCode();
      }
      setReferralCodeError("");
      return true;
    }

    const normalized = normalizeReferralCode(trimmed);
    if (!normalized) {
      setReferralCodeError(copy.auth.referralCodeInvalid);
      return false;
    }

    persistReferralCode(normalized);
    setReferralCodeInput(normalized);
    setReferralCodeError("");
    return true;
  }, [referralCodeInput, showReferralCodeInput]);

  const toggleReferralCodeInput = useCallback(() => {
    setShowReferralCodeInput((open) => !open);
    setReferralCodeError("");
  }, []);

  const ensureTurnstile = useCallback(
    (required = true) => {
      if (!required || !isTurnstileRequired()) return true;
      if (!turnstileToken) {
        setTurnstileError("Complete the verification check.");
        return false;
      }
      setTurnstileError("");
      return true;
    },
    [turnstileToken]
  );

  const resetForm = useCallback(() => {
    setStep("email");
    setSignupToken("");
    setIsSubmitting(false);
    setEmail("");
    setEmailOtp("");
    setPassword("");
    setMobile("");
    setMobileOtp("");
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setEmailError("");
    setLoginError("");
    setPasswordError("");
    setEmailOtpError("");
    setMobileError("");
    setMobileOtpError("");
    setProfileErrors({});
    setForgotEmail("");
    setForgotEmailError("");
    setForgotSent(false);
    setIsLoginMode(false);
    const storedReferralCode = readReferralCode();
    setReferralCodeInput(storedReferralCode ?? "");
    setShowReferralCodeInput(Boolean(storedReferralCode));
    setReferralCodeError("");
    setMfaToken("");
    setMfaCode("");
    setBackupCode("");
    setUseBackupCode(false);
    setMfaError("");
    setLinkToken("");
    setEmailHint("");
    setOauthLinkProvider("google");
    setOauthLinkOtp("");
    setOauthLinkPassword("");
    setOauthLinkError("");
  }, []);

  const finishAuth = useCallback(() => {
    resetForm();
    onClose();
    router.push("/dashboard");
  }, [onClose, resetForm, router]);

  const handleAuthFlowResult = useCallback(
    (result: Awaited<ReturnType<typeof signIn>>) => {
      if (result.next === "mfa_required") {
        setMfaToken(result.mfa_token);
        setMfaCode("");
        setBackupCode("");
        setUseBackupCode(false);
        setStep("mfa-challenge");
        return;
      }
      if (result.next === "oauth_link_confirmation_required") {
        setLinkToken(result.link_token);
        setEmailHint(result.email_hint);
        setOauthLinkProvider(result.provider);
        setOauthLinkOtp("");
        setOauthLinkPassword("");
        oauthLinkCooldown.startCooldown(result.retry_after_seconds ?? 30);
        setStep("oauth-link");
        return;
      }
      completeAuth(result.user);
      clearReferralCode();
      finishAuth();
    },
    [completeAuth, finishAuth, oauthLinkCooldown]
  );

  const completeSignup = useCallback(async () => {
    const errors = validateProfile({ firstName, middleName, lastName });
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const result = await signupComplete(signupToken, {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
      });
      setUser(result.user);
      kyc?.markFreshUser();
      clearReferralCode();
      finishAuth();
    } catch (error) {
      setProfileErrors({
        firstName: getAuthErrorMessage(error, "Could not complete signup. Try again."),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [finishAuth, firstName, kyc, lastName, middleName, setUser, signupToken]);

  const handleEmailContinue = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isValidEmail(email)) {
        setEmailError("Enter a valid email address.");
        return;
      }

      if (isLoginMode) {
        if (password.length < 8) {
          setLoginError("Enter your password.");
          return;
        }
        if (!ensureTurnstile(loginCaptchaRequired)) return;

        setIsSubmitting(true);
        setLoginError("");
        try {
          const result = await signIn(email, password, turnstileToken);
          consumeTurnstileToken();
          setLoginCaptchaRequired(false);
          handleAuthFlowResult(result);
        } catch (error) {
          if (error instanceof ApiError && error.captchaRequired) {
            setLoginCaptchaRequired(true);
            resetTurnstile();
          } else if (error instanceof ApiError && error.code === "turnstile_failed") {
            resetTurnstile();
          }
          setLoginError(getAuthErrorMessage(error, "Invalid email or password."));
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      if (!ensureTurnstile()) return;
      if (!commitReferralCodeInput()) return;

      setIsSubmitting(true);
      setEmailError("");
      try {
        const started = await signupStart(email, turnstileToken, readReferralCode());
        consumeTurnstileToken();
        if (started.next === "login") {
          setIsLoginMode(true);
          setLoginError("");
          setEmailError("");
          setPassword("");
          return;
        }
        if (!started.signup_token) {
          setIsLoginMode(true);
          setLoginError("");
          setEmailError("");
          setPassword("");
          return;
        }
        setSignupToken(started.signup_token);
        emailOtpCooldown.startCooldown(started.retry_after_seconds);
        setEmailOtp("");
        setStep("email-otp");
      } catch (error) {
        if (error instanceof ApiError && error.code === "turnstile_failed") {
          resetTurnstile();
        }
        syncOtpCooldownFromError(error, emailOtpCooldown.syncFromError);
        setEmailError(getAuthErrorMessage(error, "Could not continue. Try again."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      email,
      emailOtpCooldown,
      ensureTurnstile,
      handleAuthFlowResult,
      isLoginMode,
      loginCaptchaRequired,
      password,
      signIn,
      turnstileToken,
      consumeTurnstileToken,
      resetTurnstile,
      commitReferralCodeInput,
    ]
  );

  const handleMfaSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!useBackupCode && !isValidOtp(mfaCode)) {
        setMfaError(copy.auth.otpAuthenticatorError);
        return;
      }
      if (useBackupCode && backupCode.trim().length < 8) {
        setMfaError("Enter a valid backup code.");
        return;
      }

      setIsSubmitting(true);
      setMfaError("");
      try {
        const result = await verifyMfaLogin({
          mfaToken,
          totpCode: useBackupCode ? undefined : mfaCode,
          backupCode: useBackupCode ? backupCode : undefined,
        });
        completeAuth(result.user);
        finishAuth();
      } catch (error) {
        setMfaError(getAuthErrorMessage(error, "Invalid verification code."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [backupCode, completeAuth, finishAuth, mfaCode, mfaToken, useBackupCode]
  );

  const handleResendOAuthLinkOtp = useCallback(async () => {
    if (!oauthLinkCooldown.canResend || isSubmitting) return;

    setIsSubmitting(true);
    setOauthLinkError("");
    try {
      const result = await resendOAuthLinkOtp(linkToken);
      oauthLinkCooldown.startCooldown(result.retry_after_seconds);
      setOauthLinkOtp("");
    } catch (error) {
      syncOtpCooldownFromError(error, oauthLinkCooldown.syncFromError);
      setOauthLinkError(getAuthErrorMessage(error, "Could not resend code. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, linkToken, oauthLinkCooldown]);

  const handleOAuthLinkSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isValidOtp(oauthLinkOtp)) {
        setOauthLinkError(copy.auth.otpEmailError);
        return;
      }
      if (oauthLinkPassword.length < 8) {
        setOauthLinkError("Enter your account password.");
        return;
      }

      setIsSubmitting(true);
      setOauthLinkError("");
      try {
        const result = await confirmOAuthLink({
          linkToken,
          emailOtp: oauthLinkOtp,
          password: oauthLinkPassword,
        });
        if (isAuthenticatedResponse(result)) {
          completeAuth(result.user);
          finishAuth();
          return;
        }
        handleAuthFlowResult(result);
      } catch (error) {
        setOauthLinkError(
          getAuthErrorMessage(
            error,
            `Could not link ${getOAuthProviderLabel(oauthLinkProvider)} account.`
          )
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      completeAuth,
      finishAuth,
      handleAuthFlowResult,
      linkToken,
      oauthLinkOtp,
      oauthLinkPassword,
      oauthLinkProvider,
    ]
  );

  const handleResendEmailOtp = useCallback(async () => {
    if (!emailOtpCooldown.canResend || isSubmitting) return;

    setIsSubmitting(true);
    setEmailOtpError("");
    try {
      const result = await signupResendEmailOtp(signupToken);
      emailOtpCooldown.startCooldown(result.retry_after_seconds);
      setEmailOtp("");
    } catch (error) {
      syncOtpCooldownFromError(error, emailOtpCooldown.syncFromError);
      setEmailOtpError(getAuthErrorMessage(error, "Could not resend code. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  }, [emailOtpCooldown, isSubmitting, signupToken]);

  const handleEmailOtpContinue = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isValidOtp(emailOtp)) {
        setEmailOtpError(copy.auth.otpEmailError);
        return;
      }

      setIsSubmitting(true);
      setEmailOtpError("");
      try {
        await signupVerifyEmail(signupToken, emailOtp);
        setPassword("");
        setStep("password");
      } catch (error) {
        setEmailOtpError(getAuthErrorMessage(error, "Invalid or expired verification code."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [emailOtp, signupToken]
  );

  const handlePasswordContinue = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isPasswordValid(password)) return;

      setIsSubmitting(true);
      setPasswordError("");
      try {
        await signupSetPassword(signupToken, password);
        setStep("mobile");
      } catch (error) {
        setPasswordError(getAuthErrorMessage(error, "Could not save password. Try again."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, signupToken]
  );

  const handleMobileContinue = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isValidMobile(mobile)) {
        setMobileError("Enter a valid 10-digit mobile number.");
        return;
      }

      setIsSubmitting(true);
      setMobileError("");
      try {
        const result = await signupSendMobileOtp(signupToken, mobile);
        mobileOtpCooldown.startCooldown(result.retry_after_seconds);
        setMobileOtp("");
        setStep("mobile-otp");
      } catch (error) {
        syncOtpCooldownFromError(error, mobileOtpCooldown.syncFromError);
        setMobileError(getAuthErrorMessage(error, "Could not send OTP. Try again."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [mobile, mobileOtpCooldown, signupToken]
  );

  const handleResendMobileOtp = useCallback(async () => {
    if (!mobileOtpCooldown.canResend || isSubmitting) return;

    setIsSubmitting(true);
    setMobileOtpError("");
    try {
      const result = await signupSendMobileOtp(signupToken, mobile);
      mobileOtpCooldown.startCooldown(result.retry_after_seconds);
      setMobileOtp("");
    } catch (error) {
      syncOtpCooldownFromError(error, mobileOtpCooldown.syncFromError);
      setMobileOtpError(getAuthErrorMessage(error, "Could not resend OTP. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, mobile, mobileOtpCooldown, signupToken]);

  const handleMobileOtpContinue = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isValidOtp(mobileOtp)) {
        setMobileOtpError(copy.auth.otpMobileError);
        return;
      }

      setIsSubmitting(true);
      setMobileOtpError("");
      try {
        await signupVerifyMobile(signupToken, mobileOtp);
        setStep("profile");
      } catch (error) {
        setMobileOtpError(getAuthErrorMessage(error, "Invalid or expired verification code."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [mobileOtp, signupToken]
  );

  const handleProfileContinue = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      void completeSignup();
    },
    [completeSignup]
  );

  const handleForgotSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isValidEmail(forgotEmail)) {
        setForgotEmailError("Enter a valid email address.");
        return;
      }
      if (!ensureTurnstile()) return;

      setIsSubmitting(true);
      setForgotEmailError("");
      try {
        await forgotPassword(forgotEmail, turnstileToken);
        consumeTurnstileToken();
        setForgotSent(true);
      } catch (error) {
        if (error instanceof ApiError && error.code === "turnstile_failed") {
          resetTurnstile();
        }
        setForgotEmailError(getAuthErrorMessage(error, "Could not send reset link. Try again."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [consumeTurnstileToken, ensureTurnstile, forgotEmail, resetTurnstile, turnstileToken]
  );

  const handleGoogleSignIn = useCallback(async () => {
    if (!env.googleClientId) {
      setEmailError("Google Sign-In is not configured yet.");
      return;
    }
    if (!commitReferralCodeInput()) return;

    setIsSubmitting(true);
    setEmailError("");
    try {
      const { idToken } = await requestGoogleIdToken();
      const result = await signInWithGoogle(idToken);
      handleAuthFlowResult(result);
    } catch (error) {
      setEmailError(getAuthErrorMessage(error, "Google Sign-In failed."));
    } finally {
      setIsSubmitting(false);
    }
  }, [commitReferralCodeInput, handleAuthFlowResult, signInWithGoogle]);

  const handleAppleSignIn = useCallback(async () => {
    if (!env.appleClientId) {
      setEmailError("Apple Sign-In is not configured yet.");
      return;
    }
    if (!commitReferralCodeInput()) return;

    setIsSubmitting(true);
    setEmailError("");
    try {
      const { idToken, profile } = await requestAppleIdToken();
      const result = await signInWithApple(idToken, profile);
      handleAuthFlowResult(result);
    } catch (error) {
      setEmailError(getAuthErrorMessage(error, "Apple Sign-In failed."));
    } finally {
      setIsSubmitting(false);
    }
  }, [commitReferralCodeInput, handleAuthFlowResult, signInWithApple]);

  const goToForgotPassword = useCallback(() => {
    setForgotEmail(email);
    setForgotSent(false);
    setStep("forgot-password");
  }, [email]);

  const backToSignInFromForgot = useCallback(() => {
    setStep("email");
    if (forgotEmail) {
      setEmail(forgotEmail);
      setIsLoginMode(true);
    }
  }, [forgotEmail]);

  const headerCopy =
    step === "email" && isLoginMode ? AUTH_STEP_COPY.login : AUTH_STEP_COPY[step];
  const progressStep = getAuthProgressStep(step);

  return {
    step,
    setStep,
    isSubmitting,
    email,
    setEmail,
    emailOtp,
    setEmailOtp,
    password,
    setPassword,
    mobile,
    setMobile,
    mobileOtp,
    setMobileOtp,
    firstName,
    setFirstName,
    middleName,
    setMiddleName,
    lastName,
    setLastName,
    emailError,
    setEmailError,
    loginError,
    setLoginError,
    passwordError,
    setPasswordError,
    emailOtpError,
    setEmailOtpError,
    mobileError,
    setMobileError,
    mobileOtpError,
    setMobileOtpError,
    profileErrors,
    setProfileErrors,
    forgotEmail,
    setForgotEmail,
    forgotEmailError,
    setForgotEmailError,
    forgotSent,
    isLoginMode,
    setIsLoginMode,
    referralCodeInput,
    setReferralCodeInput,
    showReferralCodeInput,
    toggleReferralCodeInput,
    referralCodeError,
    setReferralCodeError,
    commitReferralCodeInput,
    turnstileToken,
    setTurnstileToken,
    turnstileVerified: Boolean(turnstileToken),
    turnstileError,
    turnstileResetKey,
    resetTurnstile,
    loginCaptchaRequired,
    mfaCode,
    setMfaCode,
    backupCode,
    setBackupCode,
    useBackupCode,
    setUseBackupCode,
    mfaError,
    setMfaError,
    emailHint,
    oauthLinkProvider,
    oauthLinkOtp,
    setOauthLinkOtp,
    oauthLinkPassword,
    setOauthLinkPassword,
    oauthLinkError,
    setOauthLinkError,
    emailOtpCooldown,
    mobileOtpCooldown,
    oauthLinkCooldown,
    defaultCountry: DEFAULT_COUNTRY,
    headerCopy,
    progressStep: progressStep as SignupStepId | null,
    resetForm,
    handleEmailContinue,
    handleMfaSubmit,
    handleResendOAuthLinkOtp,
    handleOAuthLinkSubmit,
    handleResendEmailOtp,
    handleEmailOtpContinue,
    handlePasswordContinue,
    handleMobileContinue,
    handleResendMobileOtp,
    handleMobileOtpContinue,
    handleProfileContinue,
    handleForgotSubmit,
    handleGoogleSignIn,
    handleAppleSignIn,
    goToForgotPassword,
    backToSignInFromForgot,
  };
}

export function AuthDialogFlowProvider({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const value = useAuthDialogFlowState(onClose);
  return (
    <AuthDialogFlowContext.Provider value={value}>{children}</AuthDialogFlowContext.Provider>
  );
}

export function useAuthDialogFlow() {
  const context = useContext(AuthDialogFlowContext);
  if (!context) {
    throw new Error("useAuthDialogFlow must be used within AuthDialogFlowProvider");
  }
  return context;
}

export function useAuthDialogHeader() {
  const { step, isLoginMode, headerCopy, progressStep } = useAuthDialogFlow();
  return useMemo(
    () => ({
      step,
      isLoginMode,
      title: headerCopy.title,
      description: headerCopy.description,
      progressStep,
    }),
    [headerCopy.description, headerCopy.title, isLoginMode, progressStep, step]
  );
}
