import { describe, expect, it } from "vitest";

import { stripFathersNameDigilockerPrefixes } from "@/features/kyc/lib/kyc-fathers-name-prefix";
import { normalizeFathersNameFromDigilocker } from "@/features/kyc/lib/kyc-name-validation";

const PREFIX_CASES: Array<[string, string]> = [
  ["S/o Rajesh Kushwah", "Rajesh Kushwah"],
  ["S/O Rajesh Kushwah", "Rajesh Kushwah"],
  ["s/o: Rajesh Kushwah", "Rajesh Kushwah"],
  ["S / O Rajesh Kushwah", "Rajesh Kushwah"],
  ["S.O. Rajesh Kushwah", "Rajesh Kushwah"],
  ["SO Rajesh Kushwah", "Rajesh Kushwah"],
  ["SO: Rajesh Kushwah", "Rajesh Kushwah"],
  ["so of Rajesh Kushwah", "Rajesh Kushwah"],
  ["Son of Rajesh Kushwah", "Rajesh Kushwah"],
  ["D/o Anita Devi", "Anita Devi"],
  ["W/o Lakshmi Devi", "Lakshmi Devi"],
  ["C/o Ramesh Kumar", "Ramesh Kumar"],
  ["H/o Rajesh Kumar", "Rajesh Kumar"],
  ["Care of S/o Nested Name", "Nested Name"],
];

describe("stripFathersNameDigilockerPrefixes", () => {
  it.each(PREFIX_CASES)("strips %s", (raw, expected) => {
    expect(stripFathersNameDigilockerPrefixes(raw)).toBe(expected);
    expect(normalizeFathersNameFromDigilocker(raw)).toBe(expected);
  });
});
