import { describe, expect, it } from "vitest";

import { phase0ConfigSanity } from "@/shared/config/phase0-sanity";

describe("phase0ConfigSanity", () => {
  it("passes config guardrails", () => {
    expect(phase0ConfigSanity()).toBe(true);
  });
});
