import type { KycAddressFields } from "@/features/kyc/lib/kyc-address";
import { copy } from "@/shared/config/copy";

export const KYC_ADDRESS_LIMITS = {
  line1: { min: 3, max: 120 },
  line2: { max: 120 },
  city: { min: 2, max: 60 },
  pincode: { length: 6 },
} as const;

const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export function validateKycAddressFields(address: KycAddressFields) {
  const errors: Partial<Record<keyof KycAddressFields, string>> = {};
  const line1 = address.line1.trim();
  const line2 = address.line2.trim();
  const city = address.city.trim();
  const pincode = address.pincode.trim();

  if (!line1) {
    errors.line1 = copy.kyc.address.requiredField;
  } else if (line1.length < KYC_ADDRESS_LIMITS.line1.min || line1.length > KYC_ADDRESS_LIMITS.line1.max) {
    errors.line1 = copy.kyc.address.invalidLine1;
  }

  if (line2.length > KYC_ADDRESS_LIMITS.line2.max) {
    errors.line2 = copy.kyc.address.invalidLine2;
  }

  if (!city) {
    errors.city = copy.kyc.address.requiredField;
  } else if (city.length < KYC_ADDRESS_LIMITS.city.min || city.length > KYC_ADDRESS_LIMITS.city.max) {
    errors.city = copy.kyc.address.invalidCity;
  }

  if (!address.state.trim()) {
    errors.state = copy.kyc.address.requiredField;
  }

  if (!pincode) {
    errors.pincode = copy.kyc.address.requiredField;
  } else if (!PINCODE_PATTERN.test(pincode)) {
    errors.pincode = copy.kyc.address.invalidPincode;
  }

  return errors;
}
