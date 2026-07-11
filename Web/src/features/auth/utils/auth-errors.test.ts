import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import {
  getAuthErrorMessage,
  syncOtpCooldownFromError,
} from "@/features/auth/utils/auth-errors";

describe("auth-errors", () => {
  it("extracts ApiError messages", () => {
    expect(getAuthErrorMessage(new ApiError("Invalid code", "invalid_otp"), "Fallback")).toBe(
      "Invalid code"
    );
  });

  it("falls back for unknown errors", () => {
    expect(getAuthErrorMessage("nope", "Fallback")).toBe("Fallback");
  });

  it("syncs OTP cooldown from ApiError retry_after", () => {
    const sync = vi.fn();
    syncOtpCooldownFromError(new ApiError("Slow down", "rate_limited", 429, false, 30), sync);
    expect(sync).toHaveBeenCalledWith(30);
  });
});
