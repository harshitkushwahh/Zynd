import { describe, expect, it } from "vitest";

import {
  extractIndianPincode,
  mapApprovedZtoToAddressPrefill,
  mapApprovedZtoToBankPrefill,
  mapApprovedZtoToPanPrefill,
} from "@/features/kyc/lib/zto-prefill";
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
  address_line_1: "221B Baker Street",
  address_line_2: "",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560038",
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
    expect(
      normalizeZtoReviewFields({ ...valid, pan: " abcde1234f ", ifsc_code: "hdfc0000001", city: "  " }),
    ).toMatchObject({
      pan: "ABCDE1234F",
      ifsc_code: "HDFC0000001",
      city: null,
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

describe("mapApprovedZtoToBankPrefill", () => {
  it("maps approved bank fields into a bank form seed", () => {
    expect(mapApprovedZtoToBankPrefill(valid)).toMatchObject({
      accountNumber: "123456789012",
      ifscCode: "HDFC0000001",
      accountType: "",
    });
  });

  it("returns null when bank fields are empty", () => {
    expect(mapApprovedZtoToBankPrefill({ ...valid, bank_account_number: "", ifsc_code: "" })).toBeNull();
  });
});

describe("mapApprovedZtoToAddressPrefill", () => {
  it("maps split address fields into the KYC address form", () => {
    expect(mapApprovedZtoToAddressPrefill(valid)).toMatchObject({
      permanent: {
        line1: "221B Baker Street",
        line2: "",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038",
      },
      sameAsPermanent: true,
    });
  });

  it("extracts pincode from a combined address line and fills city/state via pin field", () => {
    const mapped = mapApprovedZtoToAddressPrefill({
      ...valid,
      address_line_1: null,
      address_line_2: null,
      city: null,
      state: null,
      pincode: null,
      address_line: "Flat 4, MG Road, Bengaluru 560038",
    });
    expect(mapped?.permanent.line1).toBe("Flat 4, MG Road, Bengaluru");
    expect(mapped?.permanent.pincode).toBe("560038");
  });

  it("returns null when no address data is present", () => {
    expect(
      mapApprovedZtoToAddressPrefill({
        ...valid,
        address_line_1: "",
        address_line_2: "",
        city: "",
        state: "",
        pincode: "",
        address_line: "",
      }),
    ).toBeNull();
  });
});

describe("extractIndianPincode", () => {
  it("finds a 6-digit pincode in free text", () => {
    expect(extractIndianPincode("Sector 12, Noida 201301")).toBe("201301");
  });
});
