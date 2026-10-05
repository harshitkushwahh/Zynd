import { describe, expect, it } from "vitest";

import {
  formatNomineeDobDisplay,
  formatNomineeDobForDateInput,
  formatNomineeDobInput,
  getNomineeTypeFromDob,
  isFutureNomineeDob,
  nomineeContinueRequiresOptOutDialog,
  parseNomineeDob,
} from "@/features/kyc/lib/kyc-nominee";
import {
  validateKycNomineeAddress,
  validateKycNomineeEmail,
  validateKycNomineeMobile,
  validateOptionalKycNomineeDocument,
} from "@/features/kyc/lib/kyc-nominee-validation";

describe("nominee opt-out dialog gate", () => {
  it("requires dialog only for empty list without prior opt-out", () => {
    expect(nomineeContinueRequiresOptOutDialog(0, false)).toBe(true);
    expect(nomineeContinueRequiresOptOutDialog(0, true)).toBe(false);
    expect(nomineeContinueRequiresOptOutDialog(1, false)).toBe(false);
  });
});

describe("nominee date of birth", () => {
  it("parses typed dd/mm/yyyy and ISO values", () => {
    expect(parseNomineeDob("15/08/2000")?.getFullYear()).toBe(2000);
    expect(formatNomineeDobForDateInput("15/08/2000")).toBe("2000-08-15");
    expect(formatNomineeDobDisplay("2000-08-15")).toBe("15/08/2000");
  });

  it("formats keyboard input as dd/mm/yyyy", () => {
    expect(formatNomineeDobInput("15082000")).toBe("15/08/2000");
  });

  it("classifies adult and minor from date of birth", () => {
    expect(getNomineeTypeFromDob("2000-08-15")).toBe("individual");
    expect(getNomineeTypeFromDob("2024-01-01")).toBe("minor");
  });

  it("rejects a future date of birth", () => {
    expect(isFutureNomineeDob("2099-01-01")).toBe(true);
    expect(isFutureNomineeDob("2000-01-01")).toBe(false);
  });
});

describe("optional nominee fields", () => {
  it("allows empty contact and identity", () => {
    expect(validateKycNomineeEmail("")).toBeUndefined();
    expect(validateKycNomineeMobile("")).toBeUndefined();
    expect(validateOptionalKycNomineeDocument("", "")).toBeUndefined();
    expect(validateKycNomineeAddress({ line1: "", line2: "", city: "", pincode: "" })).toEqual({});
  });

  it("validates contact and identity when they are filled", () => {
    expect(validateKycNomineeEmail("not-an-email")).toBeTruthy();
    expect(validateOptionalKycNomineeDocument("pan", "123")).toBeTruthy();
    expect(
      validateKycNomineeAddress({ line1: "12", line2: "", city: "", pincode: "" }).line1,
    ).toBeTruthy();
  });
});
