import { INPUT_RULES } from "@zynd/shared";

export function isPasswordValid(password: string): boolean {
  if (password.length < INPUT_RULES.password.minLength) return false;
  if (password.length > INPUT_RULES.password.maxLength) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}
