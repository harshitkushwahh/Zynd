import { copy } from "@/shared/config/copy";
import {
  KYC_PERSON_NAME_LIMITS,
  validateKycPersonName as validatePersonName,
} from "@/features/kyc/lib/kyc-name-validation";

export const KYC_NOMINEE_LIMITS = {
  fullName: KYC_PERSON_NAME_LIMITS,
  addressLine1: { min: 3, max: 120 },
  addressLine2: { max: 120 },
  city: { min: 2, max: 60 },
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export {
  getNomineeDocumentInvalidMessage,
  getNomineeDocumentMaxLength,
  getNomineeDocumentPlaceholder,
  normalizeNomineeDocumentNumber,
  validateKycNomineeDocument,
} from "@/features/kyc/lib/kyc-nominee-document";

export { normalizePersonNameInput, normalizePlaceOfBirthInput } from "@/features/kyc/lib/kyc-name-validation";

export function validateKycPersonName(value: string) {
  return validatePersonName(value);
}

export function validateKycNomineeEmail(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return copy.kyc.nominee.requiredField;
  if (!EMAIL_PATTERN.test(trimmed)) return copy.kyc.nominee.invalidEmail;

  return undefined;
}

export function validateKycNomineeMobile(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) return copy.kyc.nominee.requiredField;
  if (!MOBILE_PATTERN.test(digits)) return copy.kyc.nominee.invalidMobile;

  return undefined;
}

export function validateKycNomineeAddress(fields: {
  line1: string;
  line2: string;
  city: string;
  pincode: string;
}) {
  const errors: Record<string, string> = {};
  const line1 = fields.line1.trim();
  const line2 = fields.line2.trim();
  const city = fields.city.trim();
  const pincode = fields.pincode.trim();

  if (!line1) {
    errors.line1 = copy.kyc.nominee.requiredField;
  } else if (
    line1.length < KYC_NOMINEE_LIMITS.addressLine1.min ||
    line1.length > KYC_NOMINEE_LIMITS.addressLine1.max
  ) {
    errors.line1 = copy.kyc.nominee.invalidAddressLine1;
  }

  if (line2.length > KYC_NOMINEE_LIMITS.addressLine2.max) {
    errors.line2 = copy.kyc.nominee.invalidAddressLine2;
  }

  if (!city) {
    errors.city = copy.kyc.nominee.requiredField;
  } else if (city.length < KYC_NOMINEE_LIMITS.city.min || city.length > KYC_NOMINEE_LIMITS.city.max) {
    errors.city = copy.kyc.nominee.invalidCity;
  }

  if (!pincode) {
    errors.pincode = copy.kyc.nominee.requiredField;
  } else if (!PINCODE_PATTERN.test(pincode)) {
    errors.pincode = copy.kyc.address.invalidPincode;
  }

  return errors;
}
