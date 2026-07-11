import {
  DEFAULT_COUNTRY,
  INPUT_RULES,
} from "@/lib/input-rules";
import { storageKeys } from "@/shared/config/storage-keys";

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (
    trimmed.length < INPUT_RULES.email.minLength ||
    trimmed.length > INPUT_RULES.email.maxLength
  ) {
    return false;
  }
  return new RegExp(`^${INPUT_RULES.email.pattern}$`).test(trimmed);
}

export function isValidOtp(code: string): boolean {
  return new RegExp(`^${INPUT_RULES.otp.pattern}$`).test(code.trim());
}

export function isValidMobile(mobile: string): boolean {
  const digits = mobile.replace(/\s/g, "");
  return new RegExp(`^${INPUT_RULES.mobile.pattern}$`).test(digits);
}

export function isValidName(name: string, required = true): boolean {
  const trimmed = name.trim();
  if (!required && !trimmed) return true;
  if (!trimmed) return false;
  if (required) {
    return new RegExp(`^${INPUT_RULES.firstName.pattern}$`).test(trimmed);
  }
  return new RegExp(`^${INPUT_RULES.middleName.pattern}$`).test(trimmed);
}

export type ProfileForm = {
  firstName: string;
  middleName: string;
  lastName: string;
};

export function validateProfile(form: ProfileForm) {
  const errors: Partial<Record<keyof ProfileForm, string>> = {};

  if (!isValidName(form.firstName, true)) {
    errors.firstName = INPUT_RULES.firstName.title;
  }
  if (form.middleName.trim() && !isValidName(form.middleName, false)) {
    errors.middleName = INPUT_RULES.middleName.title;
  }
  if (!isValidName(form.lastName, true)) {
    errors.lastName = INPUT_RULES.lastName.title;
  }

  return errors;
}

export function isProfileValid(form: ProfileForm): boolean {
  return Object.keys(validateProfile(form)).length === 0;
}

export type SignupSession = {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
  country: typeof DEFAULT_COUNTRY.code;
};

export const SIGNUP_SESSION_KEY = storageKeys.signupSession;

export function saveSignupSession(data: SignupSession) {
  sessionStorage.setItem(SIGNUP_SESSION_KEY, JSON.stringify(data));
}

export function getSignupSession(): SignupSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SIGNUP_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SignupSession;
  } catch {
    return null;
  }
}

export { DEFAULT_COUNTRY };
