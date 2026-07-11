import { beforeEach, describe, expect, it } from "vitest";

import {
  consumeLoginSecurityAlerts,
  storeLoginSecurityAlerts,
} from "@/features/account/security/login-security-alerts";
import { storageKeys } from "@/shared/config/storage-keys";

describe("login-security-alerts", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores and consumes alerts once", () => {
    storeLoginSecurityAlerts({ newDevice: true, velocityFlagged: false });
    expect(sessionStorage.getItem(storageKeys.loginSecurityAlerts)).toBeTruthy();

    const alerts = consumeLoginSecurityAlerts();
    expect(alerts).toEqual({ newDevice: true, velocityFlagged: false });
    expect(sessionStorage.getItem(storageKeys.loginSecurityAlerts)).toBeNull();
  });

  it("skips storage when no alerts are set", () => {
    storeLoginSecurityAlerts({ newDevice: false, velocityFlagged: false });
    expect(sessionStorage.getItem(storageKeys.loginSecurityAlerts)).toBeNull();
  });
});
