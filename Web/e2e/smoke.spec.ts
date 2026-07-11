import { expect, test } from "@playwright/test";

import { mockGuestSession } from "./helpers";

test.describe("marketing shell", () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestSession(page);
  });

  test("home page shows brand and auth entry", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /login \/ signup/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/financial life/i);
    await expect(page.locator("header")).toContainText(/zynd/i);
  });
});

test.describe("auth-adjacent routes", () => {
  test("reset password without token shows invalid link state", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.getByRole("heading", { name: /invalid reset link/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /back to home/i })).toBeVisible();
  });

  test("dashboard redirects unauthenticated users to home", async ({ page }) => {
    await mockGuestSession(page);
    await page.goto("/dashboard");
    await page.waitForURL("/", { timeout: 10_000 });

    await expect(page.getByRole("button", { name: /login \/ signup/i })).toBeVisible();
  });
});
