import { describe, expect, it } from "vitest";

import { parseMinSipSearchAmount } from "@/features/invest/lib/mf-fund-search";

describe("parseMinSipSearchAmount", () => {
  it("parses rupee amount queries", () => {
    expect(parseMinSipSearchAmount("100")).toBe(100);
    expect(parseMinSipSearchAmount("100rs")).toBe(100);
    expect(parseMinSipSearchAmount("100 rs")).toBe(100);
    expect(parseMinSipSearchAmount("500RS")).toBe(500);
    expect(parseMinSipSearchAmount("5000")).toBe(5000);
    expect(parseMinSipSearchAmount("5000rs")).toBe(5000);
    expect(parseMinSipSearchAmount("₹500")).toBe(500);
    expect(parseMinSipSearchAmount("inr100")).toBe(100);
  });

  it("rejects non-amount queries", () => {
    expect(parseMinSipSearchAmount("hdfc")).toBeNull();
    expect(parseMinSipSearchAmount("100abc")).toBeNull();
    expect(parseMinSipSearchAmount("")).toBeNull();
  });
});
