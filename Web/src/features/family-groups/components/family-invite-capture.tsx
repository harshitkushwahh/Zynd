"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { persistFamilyInviteToken } from "@/features/family-groups/lib/family-invite-storage";

export function FamilyInviteCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("family_invite");
    if (token) {
      persistFamilyInviteToken(token);
    }
  }, [searchParams]);

  return null;
}
