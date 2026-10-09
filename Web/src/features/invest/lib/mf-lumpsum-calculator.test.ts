import { describe, expect, it } from "vitest";

import { historicReturnBarPercents } from "@/features/invest/lib/mf-lumpsum-calculator";

describe("historicReturnBarPercents", () => {
  it("scales invested and gain to the largest projected value", () => {
    const row = historicReturnBarPercents(100, 150, 300);
    expect(row.totalPct).toBe(50);
    expect(row.investedPct).toBeCloseTo(100 / 300 * 100);
    expect(row.gainPct).toBeCloseTo(50 / 300 * 100);
  });

  it("fills the row for the largest value", () => {
    const row = historicReturnBarPercents(100, 400, 400);
    expect(row.totalPct).toBe(100);
    expect(row.investedPct).toBe(25);
    expect(row.gainPct).toBe(75);
  });

  it("hides gains when value is below invested", () => {
    const row = historicReturnBarPercents(100, 80, 100);
    expect(row.totalPct).toBe(80);
    expect(row.investedPct).toBe(80);
    expect(row.gainPct).toBe(0);
  });
});
