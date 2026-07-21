"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { FamilyGroupJoinDialog } from "@/features/family-groups/components/family-group-join-dialog";
import {
  clearFamilyInviteToken,
  readFamilyInviteToken,
} from "@/features/family-groups/lib/family-invite-storage";

function clearInviteQueryParams(router: ReturnType<typeof useRouter>) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("family_invite");
  url.searchParams.delete("family_invite_id");
  const next = `${url.pathname}${url.search}${url.hash}`;
  router.replace(next, { scroll: false });
}

function FamilyInviteHandlerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const handledRef = useRef<string | null>(null);

  const resolveInvite = useCallback(() => {
    const queryToken = searchParams.get("family_invite");
    const queryInviteId = searchParams.get("family_invite_id");
    return {
      token: queryToken ?? readFamilyInviteToken(),
      inviteId: queryInviteId,
    };
  }, [searchParams]);

  useEffect(() => {
    if (loading || !user) return;

    const resolved = resolveInvite();
    if (!resolved.token && !resolved.inviteId) return;

    const key = `${resolved.token ?? ""}:${resolved.inviteId ?? ""}`;
    if (handledRef.current === key) return;

    handledRef.current = key;
    setToken(resolved.token);
    setInviteId(resolved.inviteId);
    setOpen(true);
  }, [loading, resolveInvite, user]);

  return (
    <FamilyGroupJoinDialog
      token={token}
      inviteId={inviteId}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          clearFamilyInviteToken();
          setToken(null);
          setInviteId(null);
          handledRef.current = null;
          clearInviteQueryParams(router);
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
