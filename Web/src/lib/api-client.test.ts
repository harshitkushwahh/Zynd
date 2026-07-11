import { describe, expect, it } from "vitest";

import { parseApiError } from "@zynd/shared/api";

describe("parseApiError", () => {
  it("parses FastAPI string detail", async () => {
    const response = new Response(JSON.stringify({ detail: "Invalid credentials" }), {
      status: 401,
    });
    const error = await parseApiError(response);
    expect(error.message).toBe("Invalid credentials");
    expect(error.status).toBe(401);
  });

  it("parses structured detail with captcha and retry", async () => {
    const response = new Response(
      JSON.stringify({
        detail: {
          message: "Captcha required",
          code: "captcha_required",
          captcha_required: true,
          retry_after_seconds: 45,
        },
      }),
      { status: 429 }
    );
    const error = await parseApiError(response);
    expect(error.code).toBe("captcha_required");
    expect(error.captchaRequired).toBe(true);
    expect(error.retryAfterSeconds).toBe(45);
  });
});
