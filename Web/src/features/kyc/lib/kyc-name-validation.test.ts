import { describe, expect, it } from "vitest";

import {
  composePersonFullName,
  validateKycPersonName,
  validateOptionalKycPersonName,
} from "@/features/kyc/lib/kyc-name-validation";

describe("validateKycPersonName", () => {
  it("accepts single-letter first, middle, and last name parts", () => {
    expect(validateKycPersonName("S")).toBeUndefined();
    expect(validateKycPersonName("P")).toBeUndefined();
    expect(validateKycPersonName("K")).toBeUndefined();
    expect(validateOptionalKycPersonName("P")).toBeUndefined();
  });

  it("accepts composed names like S P Kumar", () => {
    const fullName = composePersonFullName("S", "P", "Kumar");
    expect(fullName).toBe("S P Kumar");
    expect(validateKycPersonName(fullName)).toBeUndefined();
  });

  it("rejects empty required names", () => {
    expect(validateKycPersonName("")).toBeTruthy();
    expect(validateKycPersonName("   ")).toBeTruthy();
  });

  it("allows empty optional last name when first name is present", () => {
    expect(validateOptionalKycPersonName("")).toBeUndefined();
    const mononym = composePersonFullName("Madonna", "", "");
    expect(mononym).toBe("Madonna");
    expect(validateKycPersonName(mononym)).toBeUndefined();
  });
});
