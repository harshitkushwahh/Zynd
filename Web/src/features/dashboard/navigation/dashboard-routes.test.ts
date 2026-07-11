import { describe, expect, it } from "vitest";

import {
  DASHBOARD_ROUTES,
  getDashboardPageMeta,
  isDashboardRouteActive,
  resolveDashboardRoute,
} from "@/features/dashboard/navigation/dashboard-routes";

describe("dashboard-routes", () => {
  it("matches portfolio only on exact /dashboard", () => {
    const portfolio = DASHBOARD_ROUTES[0];
    expect(isDashboardRouteActive("/dashboard", portfolio)).toBe(true);
    expect(isDashboardRouteActive("/dashboard/settings", portfolio)).toBe(false);
    expect(isDashboardRouteActive("/dashboard/transactions", portfolio)).toBe(false);
  });

  it("resolves nested dashboard paths", () => {
    expect(resolveDashboardRoute("/dashboard/transactions")?.id).toBe("transactions");
    expect(resolveDashboardRoute("/dashboard/settings")).toBeUndefined();
  });

  it("returns settings meta for settings paths", () => {
    expect(getDashboardPageMeta("/dashboard/settings").title).toBe("Settings");
  });
});
