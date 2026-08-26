"use client";

import { useAuth } from "@/contexts/auth-context";
import { useKycOptional } from "@/contexts/kyc-context";
import {
  getDisplayName,
  greetingNameFromDisplayName,
  resolveDisplayName,
} from "@/shared/utils/user-display";

export function useResolvedDisplayName(): string {
  const { user } = useAuth();
  const kyc = useKycOptional();

  if (!user) return "";

  return resolveDisplayName({
    accountName: getDisplayName(user),
    legalFullName: kyc?.legalFullName,
  });
}

export function useResolvedGreetingName(): string {
  return greetingNameFromDisplayName(useResolvedDisplayName());
}
