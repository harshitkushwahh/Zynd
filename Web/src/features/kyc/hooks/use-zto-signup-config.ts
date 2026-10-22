"use client";

import { useEffect, useState } from "react";

import { fetchZtoConfig } from "@/features/kyc/lib/zto-api";
import type { ZtoConfig } from "@/features/kyc/lib/zto-types";
import { env } from "@/lib/env";
import { APP_NAME } from "@/shared/config/brand";
import { copy } from "@/shared/config/copy";

export function fallbackZtoConfig(): ZtoConfig {
  const partner = env.appName || APP_NAME;
  return {
    enabled: env.ztoEnabled,
    mode: env.ztoEnabled ? "sandbox" : null,
    partner_name: partner,
    bank_consent: {
      purpose: "ZERO_TOUCH_BANK_LOOKUP",
      text: copy.zto.signup.bankConsent.replace("{partner}", partner),
      mode: "checkbox",
    },
    customer_consent: {
      purpose: "ZERO_TOUCH_CUSTOMER_LOOKUP",
      text: copy.zto.signup.customerConsent.replace("{partner}", partner),
      mode: "checkbox",
    },
  };
}

/** True when signup / opt-in should show Cybrilla lookup checkboxes. */
export function isZtoSignupUiEnabled(config: ZtoConfig | null | undefined): boolean {
  if (config?.enabled) return true;
  return env.ztoEnabled;
}

/**
 * Loads public ZTO config from the API; falls back to local copy when the route is missing
 * or the backend has ZTO_ENABLED=false while the Web dev flag is on.
 */
export function useZtoSignupConfig(active = true) {
  const [config, setConfig] = useState<ZtoConfig | null>(null);
  const [ready, setReady] = useState(!active);

  useEffect(() => {
    if (!active) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void fetchZtoConfig()
      .then((result) => {
        if (cancelled) return;
        if (result.enabled) {
          setConfig(result);
          return;
        }
        if (env.ztoEnabled) {
          setConfig({ ...fallbackZtoConfig(), partner_name: result.partner_name || fallbackZtoConfig().partner_name });
          return;
        }
        setConfig(result);
      })
      .catch(() => {
        if (!cancelled) setConfig(fallbackZtoConfig());
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const uiEnabled = isZtoSignupUiEnabled(config);
  const resolved = uiEnabled ? (config ?? fallbackZtoConfig()) : config;

  return { config: resolved, uiEnabled, ready };
}
