"use client";

import { useCallback, useEffect, useState } from "react";

import { useKycOptional } from "@/contexts/kyc-context";
import { ensureKycToken, fetchKycBootstrap } from "@/features/kyc/lib/kyc-api";
import {
  mapBootstrapToKycProfile,
  type SettingsKycProfile,
} from "@/features/kyc/lib/settings-kyc-profile";

export function useSettingsKycProfile(enabled: boolean) {
  const kyc = useKycOptional();
  const kycStatusResolved = !kyc?.kycAllowed || kyc.overallStatus != null;
  const kycVerified = kyc?.overallStatus === "completed";
  const shouldLoadProfile = enabled && kycStatusResolved && kycVerified;

  const [profile, setProfile] = useState<SettingsKycProfile | null>(null);
  const [loading, setLoading] = useState(enabled && !kycStatusResolved);

  const loadProfile = useCallback(async () => {
    if (!shouldLoadProfile) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await ensureKycToken();
      const bootstrap = await fetchKycBootstrap();
      if (bootstrap.step_statuses?.overall !== "completed") {
        setProfile(null);
        return;
      }
      setProfile(mapBootstrapToKycProfile(bootstrap));
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [shouldLoadProfile]);

  useEffect(() => {
    if (enabled && !kycStatusResolved) {
      setLoading(true);
      return;
    }
    void loadProfile();
  }, [enabled, kycStatusResolved, loadProfile]);

  return { profile, loading, reloadProfile: loadProfile };
}
