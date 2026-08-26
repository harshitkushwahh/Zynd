import { INPUT_RULES } from "@zynd/shared/input-rules";

export type PasswordCriterion = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_CRITERIA: PasswordCriterion[] = [
  {
    id: "length",
    label: "8+ characters",
    test: (password) => password.length >= INPUT_RULES.password.minLength,
  },
  {
    id: "uppercase",
    label: "Uppercase",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "Lowercase",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "Number",
    test: (password) => /\d/.test(password),
  },
  {
    id: "special",
    label: "Special char",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function isPasswordValid(password: string): boolean {
  if (password.length > INPUT_RULES.password.maxLength) {
    return false;
  }
  return PASSWORD_CRITERIA.every((criterion) => criterion.test(password));
}
