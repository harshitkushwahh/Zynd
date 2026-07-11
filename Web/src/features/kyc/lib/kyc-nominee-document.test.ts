import { describe, expect, it } from "vitest";

import {
  normalizeNomineeDocumentNumber,
  validateKycNomineeDocument,
} from "@/features/kyc/lib/kyc-nominee-document";
import { getPanReadinessBadge } from "@/features/kyc/lib/kyc-pan-readiness";

describe("validateKycNomineeDocument", () => {
  it("accepts PAN values from API document type slugs", () => {
    expect(validateKycNomineeDocument("pan", "mwypk9380b")).toBeUndefined();
    expect(normalizeNomineeDocumentNumber("pan", "mwypk9380b")).toBe("MWYPK9380B");
  });

  it("accepts legacy PAN labels", () => {
    expect(validateKycNomineeDocument("PAN", "ABCDE1234F")).toBeUndefined();
  });

  it("rejects invalid PAN values", () => {
    expect(validateKycNomineeDocument("pan", "12345")).toBeTruthy();
  });
});

describe("getPanReadinessBadge", () => {
  it("maps verified readiness to success badge", () => {
    expect(getPanReadinessBadge({ status: "verified" })).toEqual({
      label: "KRA registered",
      variant: "success",
    });
  });

  it("maps new-to-kyc readiness codes to warning badge", () => {
    expect(getPanReadinessBadge({ status: "failed", code: "kyc_unavailable" })).toEqual({
      label: "New to KYC",
      variant: "warning",
    });
  });

  it("maps modify-kyc readiness codes to info badge", () => {
    expect(getPanReadinessBadge({ status: "failed", code: "kyc_incomplete" })).toEqual({
      label: "KYC update required",
      variant: "info",
    });
  });
});
