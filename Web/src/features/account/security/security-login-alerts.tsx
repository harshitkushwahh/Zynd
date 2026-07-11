"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  consumeLoginSecurityAlerts,
  type LoginSecurityAlerts,
} from "@/features/account/security/login-security-alerts";
import { Button } from "@/components/ui/button";
import { UiMessage } from "@/components/ui/ui-message";
import { useSettingsNavigation } from "@/contexts/settings-navigation-context";
import { copy } from "@/shared/config/copy";

export function SecurityLoginAlerts() {
  const [alerts, setAlerts] = useState<LoginSecurityAlerts | null>(null);
  const { openSettings } = useSettingsNavigation();

  useEffect(() => {
    setAlerts(consumeLoginSecurityAlerts());
  }, []);

  if (!alerts?.newDevice && !alerts?.velocityFlagged) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {alerts.newDevice ? (
        <UiMessage variant="info" message={copy.dashboard.security.newDevice} />
      ) : null}
      {alerts.velocityFlagged ? (
        <UiMessage variant="warning" message={copy.dashboard.security.velocityFlagged} />
      ) : null}
      {(alerts.newDevice || alerts.velocityFlagged) && (
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              href="/dashboard/settings"
              onClick={() => openSettings("your-devices")}
            />
          }
        >
          {copy.dashboard.security.reviewDevices}
        </Button>
      )}
    </div>
  );
}
