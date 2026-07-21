import type { KycNomineeRecord } from "@/features/kyc/lib/kyc-nominee";
import type { NomineeFamilyGroupPreviewStatus } from "@/features/family-groups/api/family-groups-api";

export function isNomineeEligibleForFamilyPrompt(nominee: KycNomineeRecord): boolean {
  if (nominee.type === "minor") return false;
  return Boolean(nominee.contact.email.trim());
}

export function filterNomineesForFamilyPrompt(nominees: KycNomineeRecord[]): KycNomineeRecord[] {
  return nominees.filter(isNomineeEligibleForFamilyPrompt);
}

export function isActionableFamilyPreviewStatus(status: NomineeFamilyGroupPreviewStatus): boolean {
  return status === "ok" || status === "no_groups" || status === "select_group";
}
