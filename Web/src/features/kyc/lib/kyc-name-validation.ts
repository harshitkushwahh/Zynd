import { copy } from "@/shared/config/copy";

export const KYC_PERSON_NAME_LIMITS = {
  min: 2,
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

export function normalizePlaceOfBirthInput(value: string) {
  return value.replace(/[^A-Za-z\s,.\-/]/g, "").slice(0, KYC_PLACE_OF_BIRTH_LIMITS.max);
}

export function validateKycPersonName(
  value: string,
  requiredMessage = copy.kyc.nominee.requiredField,
  invalidFormatMessage = copy.kyc.nominee.invalidFullName,
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
