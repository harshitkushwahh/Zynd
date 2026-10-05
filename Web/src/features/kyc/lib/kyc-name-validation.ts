import { stripFathersNameDigilockerPrefixes } from "@/features/kyc/lib/kyc-fathers-name-prefix";
import { copy } from "@/shared/config/copy";

export const KYC_PERSON_NAME_LIMITS = {
  min: 1,
  max: 80,
} as const;

export const KYC_PLACE_OF_BIRTH_LIMITS = {
  min: 2,
  max: 80,
} as const;

const PERSON_NAME_PATTERN = /^[A-Za-z][A-Za-z\s.'-]*$/;
const PLACE_OF_BIRTH_PATTERN = /^[A-Za-z][A-Za-z\s,.\-/]*$/;

export function normalizePersonNameInput(value: string) {
  return value.replace(/[^A-Za-z\s.'-]/g, "").slice(0, KYC_PERSON_NAME_LIMITS.max);
}

export function normalizeFathersNameFromDigilocker(value: string): string {
  return normalizePersonNameInput(stripFathersNameDigilockerPrefixes(value));
}

export function normalizePlaceOfBirthInput(value: string) {
  return value.replace(/[^A-Za-z\s,.\-/]/g, "").slice(0, KYC_PLACE_OF_BIRTH_LIMITS.max);
}

export function validateKycPersonName(
  value: string,
  requiredMessage: string = copy.kyc.nominee.requiredField,
  invalidFormatMessage: string = copy.kyc.nominee.invalidFullName,
) {
  const trimmed = value.trim();

  if (!trimmed) return requiredMessage;
  if (
    trimmed.length < KYC_PERSON_NAME_LIMITS.min ||
    trimmed.length > KYC_PERSON_NAME_LIMITS.max
  ) {
    return invalidFormatMessage;
  }
  if (!PERSON_NAME_PATTERN.test(trimmed)) {
    return invalidFormatMessage;
  }

  return undefined;
}

export function validateOptionalKycPersonName(
  value: string,
  invalidFormatMessage: string = copy.kyc.nominee.invalidFullName,
) {
  if (!value.trim()) return undefined;
  return validateKycPersonName(value, invalidFormatMessage, invalidFormatMessage);
}

export function composePersonFullName(...parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

export function splitPersonFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", middleName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: "" };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export function validateKycPlaceOfBirth(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return copy.kyc.personalInfo.requiredField;
  if (
    trimmed.length < KYC_PLACE_OF_BIRTH_LIMITS.min ||
    trimmed.length > KYC_PLACE_OF_BIRTH_LIMITS.max
  ) {
    return copy.kyc.personalInfo.invalidPlaceOfBirth;
  }
  if (!PLACE_OF_BIRTH_PATTERN.test(trimmed)) {
    return copy.kyc.personalInfo.invalidPlaceOfBirth;
  }

  return undefined;
}
