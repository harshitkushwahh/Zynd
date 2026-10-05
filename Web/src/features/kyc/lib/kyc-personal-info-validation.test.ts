import { describe, expect, it } from "vitest";

import { createEmptyPersonalInfo } from "@/features/kyc/lib/kyc-personal-info";
import { validateKycPersonalInfo } from "@/features/kyc/lib/kyc-personal-info-validation";

function validPersonalInfo() {
  return {
    ...createEmptyPersonalInfo(),
    fathersName: "Rajesh Gupta",
    gender: "male",
    incomeSlab: "upto_1lakh",
    occupation: "business",
    maritalStatus: "unmarried",
    pepExposed: "not_applicable",
    placeOfBirth: "Indore",
    nationality: "India",
  };
}

describe("validateKycPersonalInfo", () => {
  it("requires spouse name when marital status is married", () => {
    const errors = validateKycPersonalInfo({
      ...validPersonalInfo(),
      maritalStatus: "married",
      spouseName: "",
    });
    expect(errors.spouseName).toBeTruthy();
  });

  it("accepts a valid spouse name when married", () => {
    const errors = validateKycPersonalInfo({
      ...validPersonalInfo(),
      maritalStatus: "married",
      spouseName: "Anita Gupta",
    });
    expect(errors.spouseName).toBeUndefined();
    expect(errors.maritalStatus).toBeUndefined();
  });

  it("does not require spouse name when unmarried", () => {
    const errors = validateKycPersonalInfo(validPersonalInfo());
    expect(errors.spouseName).toBeUndefined();
  });
});
