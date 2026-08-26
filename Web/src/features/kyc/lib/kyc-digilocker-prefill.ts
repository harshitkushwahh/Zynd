import type { KycAddressFormValue } from "@/features/kyc/lib/kyc-address";
import type { KycPersonalInfoValue } from "@/features/kyc/lib/kyc-personal-info";

export type DigilockerPrefillInput = {
  address?: KycAddressFormValue | null;
  personalInfo?: Partial<KycPersonalInfoValue> | null;
};

export function resolveStateOption(candidate: string, options: string[]): string {
  const trimmed = candidate.trim();
  if (!trimmed) return "";

  const exact = options.find((option) => option.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  const partial = options.find((option) => {
    const lower = option.toLowerCase();
    const candidateLower = trimmed.toLowerCase();
    return lower.includes(candidateLower) || candidateLower.includes(lower);
  });
  return partial ?? trimmed;
}

export function getDigilockerAddressMissingFields(
  address?: KycAddressFormValue | null,
): string[] {
  const missing: string[] = [];
  const permanent = address?.permanent;

  if (!permanent?.line1?.trim()) {
    missing.push("line1");
  }
  if (!permanent?.city?.trim()) {
    missing.push("city");
  }
  if (!/^\d{6}$/.test(permanent?.pincode?.trim() ?? "")) {
    missing.push("pincode");
  }
  if (!permanent?.state?.trim()) {
    missing.push("state");
  }

  return missing;
}

export function getDigilockerPrefillMissingFields(input: DigilockerPrefillInput): string[] {
  return [
    ...getDigilockerAddressMissingFields(input.address),
    ...(isDigilockerFathersNameMissing(input.personalInfo) ? ["fathersName"] : []),
  ];
}

export function isDigilockerAddressPrefillIncomplete(
  address?: KycAddressFormValue | null,
): boolean {
  return getDigilockerAddressMissingFields(address).length > 0;
}

export function isDigilockerPrefillIncomplete(input: DigilockerPrefillInput): boolean {
  return getDigilockerPrefillMissingFields(input).length > 0;
}

export function isDigilockerFathersNameMissing(
  personalInfo?: Partial<KycPersonalInfoValue> | null,
): boolean {
  return !personalInfo?.fathersName?.trim();
}
