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
    expect(resolveDashboardRoute("/dashboard/my-sips")?.id).toBe("my-sips");
    expect(resolveDashboardRoute("/dashboard/goals")?.id).toBe("goals");
    expect(resolveDashboardRoute("/dashboard/goals/personal")?.id).toBe("goals");
    expect(resolveDashboardRoute("/dashboard/goals/family")?.id).toBe("goals");
    expect(resolveDashboardRoute("/dashboard/goals/abc-123")?.id).toBe("goals");
    expect(resolveDashboardRoute("/dashboard/settings")).toBeUndefined();
  });

  it("returns settings meta for settings paths", () => {
    expect(getDashboardPageMeta("/dashboard/settings").title).toBe("Settings");
  });

  it("returns help meta for help paths and does not resolve as a nav route", () => {
    expect(getDashboardPageMeta("/dashboard/help").title).toBe("Help Center");
    expect(resolveDashboardRoute("/dashboard/help")).toBeUndefined();
  });

  it("returns about meta for about paths and does not resolve as a nav route", () => {
    expect(getDashboardPageMeta("/dashboard/about").title).toBe("About Zynd");
    expect(resolveDashboardRoute("/dashboard/about")).toBeUndefined();
  });
});
