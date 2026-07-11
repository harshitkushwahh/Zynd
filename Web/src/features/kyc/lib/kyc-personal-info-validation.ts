import type { KycPersonalInfoValue } from "@/features/kyc/lib/kyc-personal-info";
import {
  validateKycPersonName,
  validateKycPlaceOfBirth,
} from "@/features/kyc/lib/kyc-name-validation";
import { copy } from "@/shared/config/copy";

export function validateKycPersonalInfo(values: KycPersonalInfoValue) {
  const errors: Partial<Record<keyof KycPersonalInfoValue, string>> = {};

  const fathersNameError = validateKycPersonName(
    values.fathersName,
    copy.kyc.personalInfo.requiredField,
    copy.kyc.personalInfo.invalidFathersName,
  );
  if (fathersNameError) errors.fathersName = fathersNameError;

  const placeOfBirthError = validateKycPlaceOfBirth(values.placeOfBirth);
  if (placeOfBirthError) errors.placeOfBirth = placeOfBirthError;

  if (!values.gender.trim()) errors.gender = copy.kyc.personalInfo.requiredField;
  if (!values.incomeSlab.trim()) errors.incomeSlab = copy.kyc.personalInfo.requiredField;
  if (!values.occupation.trim()) errors.occupation = copy.kyc.personalInfo.requiredField;
  if (!values.maritalStatus.trim()) errors.maritalStatus = copy.kyc.personalInfo.requiredField;
  if (!values.pepExposed.trim()) errors.pepExposed = copy.kyc.personalInfo.requiredField;
  if (!values.nationality.trim()) errors.nationality = copy.kyc.personalInfo.requiredField;

  return errors;
}
