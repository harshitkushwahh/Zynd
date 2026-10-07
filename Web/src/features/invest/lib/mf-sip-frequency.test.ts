import { describe, expect, it } from "vitest";

import {
  SIP_FREQUENCY_DAILY,
  SIP_FREQUENCY_MONTHLY,
  defaultInstallmentsForFrequency,
  formatMinInstallmentsDisplay,
  isDailySipAllowed,
  isMonthlySipAllowed,
  normalizeSipFrequency,
  resolveMinSipForFrequency,
  validateSipInstallmentAmount,
} from "@/features/invest/lib/mf-sip-frequency";

describe("normalizeSipFrequency", () => {
  it("defaults to monthly", () => {
    expect(normalizeSipFrequency(undefined)).toBe(SIP_FREQUENCY_MONTHLY);
    expect(normalizeSipFrequency("")).toBe(SIP_FREQUENCY_MONTHLY);
  });

  it("accepts daily", () => {
    expect(normalizeSipFrequency("daily")).toBe(SIP_FREQUENCY_DAILY);
  });
});

describe("sip options eligibility", () => {
  const options = [
    { frequency: "monthly", min_inr: 500 },
    { frequency: "daily", min_inr: 100 },
  ];

  it("detects daily and monthly buckets", () => {
    expect(isDailySipAllowed(options)).toBe(true);
    expect(isMonthlySipAllowed(options)).toBe(true);
  });

  it("uses frequency-specific minimums", () => {
    expect(resolveMinSipForFrequency(SIP_FREQUENCY_DAILY, options, 500)).toBe(100);
    expect(resolveMinSipForFrequency(SIP_FREQUENCY_MONTHLY, options, 500)).toBe(500);
  });

  it("validates amount against daily min", () => {
    expect(validateSipInstallmentAmount(50, SIP_FREQUENCY_DAILY, options, 500)).toMatch(/Minimum/);
    expect(validateSipInstallmentAmount(100, SIP_FREQUENCY_DAILY, options, 500)).toBeNull();
  });
});

describe("defaultInstallmentsForFrequency", () => {
  it("uses higher default for daily", () => {
    expect(defaultInstallmentsForFrequency(SIP_FREQUENCY_DAILY)).toBe(30);
    expect(defaultInstallmentsForFrequency(SIP_FREQUENCY_MONTHLY)).toBe(12);
  });
});

describe("formatMinInstallmentsDisplay", () => {
  it("shows Any when the fund has no minimum", () => {
    expect(formatMinInstallmentsDisplay(null)).toBe("Any");
    expect(formatMinInstallmentsDisplay(undefined)).toBe("Any");
  });

  it("shows the count when set", () => {
    expect(formatMinInstallmentsDisplay(6)).toBe("6");
  });
});
