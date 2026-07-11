"use client";

import { useCallback, useEffect, useState } from "react";

import { ensureKycToken, fetchKycBootstrap } from "@/features/kyc/lib/kyc-api";
import {
  mapBootstrapToKycProfile,
  type SettingsKycProfile,
} from "@/features/kyc/lib/settings-kyc-profile";

export function useSettingsKycProfile(enabled: boolean) {
  const [profile, setProfile] = useState<SettingsKycProfile | null>(null);
  const [loading, setLoading] = useState(enabled);

  const loadProfile = useCallback(async () => {
    if (!enabled) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await ensureKycToken();
      const bootstrap = await fetchKycBootstrap();
      setProfile(mapBootstrapToKycProfile(bootstrap));
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return { profile, loading, reloadProfile: loadProfile };
}
