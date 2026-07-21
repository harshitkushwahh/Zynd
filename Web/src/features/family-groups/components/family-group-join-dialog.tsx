"use client";

import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import {
  acceptFamilyGroupInvite,
  acceptFamilyGroupInviteById,
  declineFamilyGroupInvite,
  declineFamilyGroupInviteById,
  fetchPendingFamilyInvites,
  previewFamilyGroupInvite,
  type FamilyGroupInvitePreview,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyMemberRoleBadge } from "@/features/family-groups/components/family-member-role-badge";
import { clearFamilyInviteToken } from "@/features/family-groups/lib/family-invite-storage";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupJoinDialogProps = {
  token: string | null;
  inviteId?: string | null;
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
  inviteId = null,
  open,
  onOpenChange,
  onResolved,
}: FamilyGroupJoinDialogProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<FamilyGroupInvitePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resolvedInviteId, setResolvedInviteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || (!token && !inviteId)) {
      setPreview(null);
      setError("");
      setResolvedInviteId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    async function loadPreview() {
      try {
        if (token) {
          const response = await previewFamilyGroupInvite(token);
          if (!cancelled) {
            setPreview(response);
            setResolvedInviteId(null);
          }
          return;
        }

        const response = await fetchPendingFamilyInvites();
        const invite = response.items.find((item) => item.id === inviteId);
        if (!invite) {
          throw new Error(copy.familyGroups.join.errors.previewFailed);
        }

        if (!cancelled) {
          setPreview({
            group_id: invite.group_id,
            group_title: invite.group_title,
            inviter_name: invite.inviter_name,
            intended_role: invite.intended_role,
            intended_badge_key: invite.intended_badge_key,
            intended_badge_label: invite.intended_badge_label,
            expires_at: invite.expires_at,
          });
          setResolvedInviteId(invite.id);
        }
      } catch (loadError) {
        if (!cancelled) {
          setPreview(null);
          setResolvedInviteId(null);
          setError(resolveErrorMessage(loadError, copy.familyGroups.join.errors.previewFailed));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [inviteId, open, token]);

  async function handleAccept() {
    setSubmitting(true);
    setError("");
    try {
      const joined = token
        ? await acceptFamilyGroupInvite(token)
        : await acceptFamilyGroupInviteById(resolvedInviteId ?? inviteId ?? "");
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
    setSubmitting(true);
    setError("");
    try {
      if (token) {
        await declineFamilyGroupInvite(token);
      } else {
        await declineFamilyGroupInviteById(resolvedInviteId ?? inviteId ?? "");
      }
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
          <div className={cn("border border-border bg-muted/10 p-4", FAMILY_GROUP_CARD_RADIUS_CLASS)}>
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UsersRound className="size-5" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-caption font-semibold text-foreground">{preview.group_title}</p>
                <p className="mt-1 text-compact text-muted-foreground">
                  {copy.familyGroups.join.invitedBy(preview.inviter_name)}
                </p>
                <FamilyMemberRoleBadge
                  role={preview.intended_role}
                  badgeLabel={preview.intended_badge_label}
                  className="mt-3"
                />
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
        <Button
          type="button"
          disabled={submitting || loading || !preview || (!token && !inviteId && !resolvedInviteId)}
          onClick={() => void handleAccept()}
        >
          {copy.familyGroups.join.accept}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
