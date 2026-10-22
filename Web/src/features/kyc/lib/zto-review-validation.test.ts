import { describe, expect, it } from "vitest";

import { mapApprovedZtoToPanPrefill } from "@/features/kyc/lib/zto-prefill";
import {
  normalizeZtoReviewFields,
  validateZtoReviewFields,
} from "@/features/kyc/lib/zto-review-validation";
import type { ZtoReviewFields } from "@/features/kyc/lib/zto-types";

const valid: ZtoReviewFields = {
  name: "Asha Kumari Verma",
  pan: "ABCDE1234F",
  date_of_birth: "1990-05-15",
  bank_account_number: "123456789012",
  ifsc_code: "HDFC0000001",
  address_line: "221B Baker Street",
};

describe("validateZtoReviewFields", () => {
  it("accepts well-formed values and blanks", () => {
    expect(validateZtoReviewFields(valid)).toEqual({});
    expect(validateZtoReviewFields({ ...valid, pan: "", ifsc_code: null })).toEqual({});
  });

  it("flags malformed PAN, IFSC, DOB and account", () => {
    const errors = validateZtoReviewFields({
      ...valid,
      pan: "BAD",
      ifsc_code: "XX",
      date_of_birth: "15/05/1990",
      bank_account_number: "12",
    });
    expect(Object.keys(errors).sort()).toEqual(["bank_account_number", "date_of_birth", "ifsc_code", "pan"]);
  });

  it("normalizes casing and blanks", () => {
    expect(normalizeZtoReviewFields({ ...valid, pan: " abcde1234f ", ifsc_code: "hdfc0000001", address_line: " " })).toMatchObject({
      pan: "ABCDE1234F",
      ifsc_code: "HDFC0000001",
      address_line: null,
    });
  });
});

describe("mapApprovedZtoToPanPrefill", () => {
  it("maps approved values into a PAN draft seed", () => {
    expect(mapApprovedZtoToPanPrefill(valid)).toEqual({
      panNumber: "ABCDE1234F",
      dateOfBirth: "1990-05-15",
      firstName: "Asha",
      middleName: "Kumari",
      lastName: "Verma",
    });
  });

  it("returns null when nothing to seed", () => {
    expect(mapApprovedZtoToPanPrefill(null)).toBeNull();
  });
});
