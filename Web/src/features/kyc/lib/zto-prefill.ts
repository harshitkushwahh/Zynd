import { splitPersonFullName } from "@/features/kyc/lib/kyc-name-validation";
import type { KycPanDraft } from "@/features/kyc/lib/kyc-api";
import type { ZtoReviewFields } from "@/features/kyc/lib/zto-types";

/**
 * Maps the user-approved ZTO snapshot to PAN-step input seed values.
 *
 * UI-only seed: never persisted to the KYC journey and never marks anything verified.
 * Returns null when there is nothing useful to seed.
 */
export function mapApprovedZtoToPanPrefill(
  approved: ZtoReviewFields | null | undefined,
): KycPanDraft | null {
  if (!approved) return null;
  const panNumber = approved.pan?.trim().toUpperCase() ?? "";
  const dateOfBirth = approved.date_of_birth?.trim() ?? "";
  const { firstName, middleName, lastName } = splitPersonFullName(approved.name ?? "");
  if (!panNumber && !dateOfBirth && !firstName) return null;
  return { panNumber, dateOfBirth, firstName, middleName, lastName };
}
