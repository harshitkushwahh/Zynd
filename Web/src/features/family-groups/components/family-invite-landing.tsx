"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { previewFamilyGroupInvite } from "@/features/family-groups/api/family-groups-api";
import {
  persistFamilyInviteToken,
} from "@/features/family-groups/lib/family-invite-storage";
import { useAuth } from "@/contexts/auth-context";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { copy } from "@/shared/config/copy";

type FamilyInviteLandingProps = {
  token: string;
};

export function FamilyInviteLanding({ token }: FamilyInviteLandingProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await previewFamilyGroupInvite(token);
        if (cancelled) return;
        persistFamilyInviteToken(token);

        if (user) {
          router.replace(`/dashboard/family?family_invite=${encodeURIComponent(token)}`);
          return;
        }

        router.replace(`/?family_invite=${encodeURIComponent(token)}`);
      } catch (loadError) {
        if (cancelled) return;
        setError(resolveFamilyGroupApiError(loadError, copy.familyGroups.join.errors.previewFailed));
      }
    }

    if (!loading) {
      void run();
    }

    return () => {
      cancelled = true;
    };
  }, [loading, router, token, user]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {error ? (
        <>
          <FieldMessage message={error} />
          <Button className="mt-4" onClick={() => router.replace("/")}>
            Go to Zynd
          </Button>
        </>
      ) : (
        <p className="text-compact text-muted-foreground">{copy.familyGroups.join.landingLoading}</p>
      )}
    </div>
  );
}
