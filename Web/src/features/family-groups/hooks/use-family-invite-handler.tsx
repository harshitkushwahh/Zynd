"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { FamilyGroupJoinDialog } from "@/features/family-groups/components/family-group-join-dialog";
import {
  clearFamilyInviteToken,
  readFamilyInviteToken,
} from "@/features/family-groups/lib/family-invite-storage";

function FamilyInviteHandlerInner() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const handledRef = useRef<string | null>(null);

  const resolveToken = useCallback(() => {
    const queryToken = searchParams.get("family_invite");
    return queryToken ?? readFamilyInviteToken();
  }, [searchParams]);

  useEffect(() => {
    if (loading || !user) return;

    const resolved = resolveToken();
    if (!resolved || handledRef.current === resolved) return;

    handledRef.current = resolved;
    setToken(resolved);
    setOpen(true);
  }, [loading, resolveToken, user]);

  return (
    <FamilyGroupJoinDialog
      token={token}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          clearFamilyInviteToken();
          setToken(null);
        }
      }}
    />
  );
}

export function FamilyInviteHandler() {
  return (
    <Suspense fallback={null}>
      <FamilyInviteHandlerInner />
    </Suspense>
  );
}
