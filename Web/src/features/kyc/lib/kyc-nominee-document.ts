import { copy } from "@/shared/config/copy";

export type NomineeDocumentTypeKey =
  | "pan"
  | "aadhaar"
  | "passport"
  | "driving_licence"
  | "voter_id";

const LEGACY_DOCUMENT_TYPE_ALIASES: Record<string, NomineeDocumentTypeKey> = {
  pan: "pan",
  PAN: "pan",
  aadhaar: "aadhaar",
  Aadhaar: "aadhaar",
  passport: "passport",
  Passport: "passport",
  driving_licence: "driving_licence",
  "Driving licence": "driving_licence",
  voter_id: "voter_id",
  "Voter ID": "voter_id",
};

export const NOMINEE_DOCUMENT_MAX_LENGTHS: Record<NomineeDocumentTypeKey, number> = {
  pan: 10,
  aadhaar: 12,
  passport: 8,
  driving_licence: 20,
  voter_id: 10,
};

const DOCUMENT_PATTERNS: Record<NomineeDocumentTypeKey, RegExp> = {
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  aadhaar: /^\d{12}$/,
  passport: /^[A-Z][1-9]\d{7}$/,
  driving_licence: /^[A-Z0-9]{6,20}$/,
  voter_id: /^[A-Z]{3}[0-9]{7}$/,
};

export function resolveNomineeDocumentTypeKey(documentType: string): NomineeDocumentTypeKey | null {
  const trimmed = documentType.trim();
  if (!trimmed) return null;
  return LEGACY_DOCUMENT_TYPE_ALIASES[trimmed] ?? null;
}

export function getNomineeDocumentPlaceholder(documentType: string) {
  switch (resolveNomineeDocumentTypeKey(documentType)) {
    case "pan":
      return copy.kyc.nominee.placeholders.documentPan;
    case "aadhaar":
      return copy.kyc.nominee.placeholders.documentAadhaar;
    case "passport":
      return copy.kyc.nominee.placeholders.documentPassport;
    case "driving_licence":
      return copy.kyc.nominee.placeholders.documentDrivingLicence;
    case "voter_id":
      return copy.kyc.nominee.placeholders.documentVoterId;
    default:
      return copy.kyc.nominee.placeholders.documentNumber;
  }
}

export function getNomineeDocumentMaxLength(documentType: string) {
  const key = resolveNomineeDocumentTypeKey(documentType);
  return key ? NOMINEE_DOCUMENT_MAX_LENGTHS[key] : undefined;
}

export function getNomineeDocumentInvalidMessage(documentType: string) {
  switch (resolveNomineeDocumentTypeKey(documentType)) {
    case "pan":
      return copy.kyc.nominee.invalidPan;
    case "aadhaar":
      return copy.kyc.nominee.invalidAadhaar;
    case "passport":
      return copy.kyc.nominee.invalidPassport;
    case "driving_licence":
      return copy.kyc.nominee.invalidDrivingLicence;
    case "voter_id":
      return copy.kyc.nominee.invalidVoterId;
    default:
      return copy.kyc.nominee.invalidDocumentNumber;
  }
}

export function normalizeNomineeDocumentNumber(documentType: string, value: string) {
  const key = resolveNomineeDocumentTypeKey(documentType);
  const trimmed = value.trim();

  if (key === "pan") {
    return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, NOMINEE_DOCUMENT_MAX_LENGTHS.pan);
  }

  if (key === "passport") {
    return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, NOMINEE_DOCUMENT_MAX_LENGTHS.passport);
  }

  if (key === "voter_id") {
    return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, NOMINEE_DOCUMENT_MAX_LENGTHS.voter_id);
  }

  if (key === "aadhaar") {
    return trimmed.replace(/\D/g, "").slice(0, NOMINEE_DOCUMENT_MAX_LENGTHS.aadhaar);
  }

  if (key === "driving_licence") {
    return trimmed
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, NOMINEE_DOCUMENT_MAX_LENGTHS.driving_licence);
  }

  return trimmed;
}

export function validateKycNomineeDocument(documentType: string, documentNumber: string) {
  const key = resolveNomineeDocumentTypeKey(documentType);
  if (!key) return copy.kyc.nominee.requiredField;

  const normalized = normalizeNomineeDocumentNumber(documentType, documentNumber);
  if (!normalized) return copy.kyc.nominee.requiredField;

  const pattern = DOCUMENT_PATTERNS[key];
  if (!pattern.test(normalized)) {
    return getNomineeDocumentInvalidMessage(documentType);
  }

  return undefined;
}

export function nomineeDocumentUsesUppercaseInput(documentType: string) {
  const key = resolveNomineeDocumentTypeKey(documentType);
  return key === "pan" || key === "passport" || key === "voter_id" || key === "driving_licence";
}
