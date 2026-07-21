"use client";

import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  acceptFamilyGroupInvite,
  declineFamilyGroupInvite,
  previewFamilyGroupInvite,
  type FamilyGroupInvitePreview,
} from "@/features/family-groups/api/family-groups-api";
import { clearFamilyInviteToken } from "@/features/family-groups/lib/family-invite-storage";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";

type FamilyGroupJoinDialogProps = {
  token: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
};

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function FamilyGroupJoinDialog({
  token,
  open,
  onOpenChange,
  onResolved,
}: FamilyGroupJoinDialogProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<FamilyGroupInvitePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !token) {
      setPreview(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void previewFamilyGroupInvite(token)
      .then((response) => {
        if (!cancelled) setPreview(response);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(resolveErrorMessage(loadError, copy.familyGroups.join.errors.previewFailed));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  async function handleAccept() {
    if (!token) return;
    setSubmitting(true);
    setError("");
    try {
      const joined = await acceptFamilyGroupInvite(token);
      clearFamilyInviteToken();
      onOpenChange(false);
      onResolved?.();
      router.push(buildFamilyGroupHref(joined.id));
    } catch (acceptError) {
      setError(resolveErrorMessage(acceptError, copy.familyGroups.join.errors.acceptFailed));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    if (!token) return;
    setSubmitting(true);
    setError("");
    try {
      await declineFamilyGroupInvite(token);
      clearFamilyInviteToken();
      onOpenChange(false);
      onResolved?.();
    } catch (declineError) {
      setError(resolveErrorMessage(declineError, copy.familyGroups.join.errors.declineFailed));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.familyGroups.join.title}
      description={copy.familyGroups.join.description}
      icon={UsersRound}
      maxWidth="md"
    >
      <div className="space-y-4 px-6 py-5">
        {loading ? (
          <p className="text-compact text-muted-foreground">{copy.familyGroups.join.loading}</p>
        ) : preview ? (
          <div className="rounded-[var(--radius-card)] border border-border bg-muted/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UsersRound className="size-5" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-caption font-semibold text-foreground">{preview.group_title}</p>
                <p className="mt-1 text-compact text-muted-foreground">
                  {copy.familyGroups.join.invitedBy(preview.inviter_name)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge variant="neutral" showIcon={false}>
                    {copy.familyGroups.join.roleLabel(preview.intended_role)}
                  </StatusBadge>
                  {preview.intended_badge_label ? (
                    <StatusBadge variant="info" showIcon={false}>
                      {preview.intended_badge_label}
                    </StatusBadge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-compact text-destructive">{error}</p> : null}
      </div>

      <BrandDialogFooter>
        <Button type="button" variant="outline" disabled={submitting} onClick={() => void handleDecline()}>
          {copy.familyGroups.join.decline}
        </Button>
        <Button type="button" disabled={submitting || loading || !preview} onClick={() => void handleAccept()}>
          {copy.familyGroups.join.accept}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
