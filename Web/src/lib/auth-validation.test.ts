import { describe, expect, it } from "vitest";

import {
  isValidEmail,
  isValidMobile,
  isValidName,
  isValidOtp,
  isProfileValid,
  validateProfile,
} from "@/lib/auth-validation";

describe("auth-validation", () => {
  it("validates email addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("bad")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("validates OTP codes", () => {
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("abcdef")).toBe(false);
  });

  it("validates Indian mobile numbers", () => {
    expect(isValidMobile("9876543210")).toBe(true);
    expect(isValidMobile("5876543210")).toBe(false);
  });

  it("validates profile names", () => {
    const valid = { firstName: "Ada", middleName: "", lastName: "Lovelace" };
    expect(isProfileValid(valid)).toBe(true);
    expect(validateProfile(valid)).toEqual({});

    const invalid = { firstName: "A", middleName: "123", lastName: "Lovelace" };
    expect(isProfileValid(invalid)).toBe(false);
    expect(isValidName(invalid.firstName, true)).toBe(false);
  });
});
