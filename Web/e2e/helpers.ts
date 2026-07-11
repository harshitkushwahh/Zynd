import type { Page } from "@playwright/test";

/** Stub auth bootstrap so E2E runs without a live backend. */
export async function mockGuestSession(page: Page) {
  await page.context().clearCookies();

  const unauthorized = {
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({
      detail: { message: "Session expired", code: "session_expired" },
    }),
  } as const;

  await page.route("**/auth/refresh**", async (route) => {
    await route.fulfill(unauthorized);
  });

  await page.route("**/auth/me**", async (route) => {
    await route.fulfill(unauthorized);
  });
}
