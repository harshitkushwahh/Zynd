"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Mail, UserPlus } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createFamilyGroupInvite,
  fetchFamilyGroupBadges,
  type CreateFamilyGroupInviteInput,
  type FamilyGroupBadgePreset,
  type FamilyGroupInvite,
  type InvitableFamilyGroupRole,
} from "@/features/family-groups/api/family-groups-api";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { toast } from "sonner";

type FamilyGroupInviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupTitle: string;
  memberCount: number;
  pendingInviteCount: number;
  memberLimit: number;
  onInviteCreated?: (invite: FamilyGroupInvite) => void;
};

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function FamilyGroupInviteDialog({
  open,
  onOpenChange,
  groupId,
  groupTitle,
  memberCount,
  pendingInviteCount,
  memberLimit,
  onInviteCreated,
}: FamilyGroupInviteDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableFamilyGroupRole>("viewer");
  const [badgeKey, setBadgeKey] = useState<string>("");
  const [customBadgeLabel, setCustomBadgeLabel] = useState("");
  const [badges, setBadges] = useState<FamilyGroupBadgePreset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [latestShareUrl, setLatestShareUrl] = useState<string | null>(null);

  const reservedSlots = memberCount + pendingInviteCount;
  const atCapacity = reservedSlots >= memberLimit;

  useEffect(() => {
    if (!open) return;
    void fetchFamilyGroupBadges()
      .then((response) => setBadges(response.items))
      .catch(() => setBadges([]));
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (atCapacity) return;

    setSubmitting(true);
    setError("");
    try {
      const input: CreateFamilyGroupInviteInput = {
        invitee_email: email.trim(),
        intended_role: role,
      };
      if (badgeKey) {
        input.intended_badge_key = badgeKey;
        if (badgeKey === "custom") {
          input.intended_badge_label = customBadgeLabel.trim();
        }
      }

      const invite = await createFamilyGroupInvite(groupId, input);
      setLatestShareUrl(invite.share_url ?? null);
      onInviteCreated?.(invite);
      toast.success(copy.familyGroups.invite.successTitle);
      setEmail("");
      setCustomBadgeLabel("");
    } catch (submitError) {
      setError(resolveErrorMessage(submitError, copy.familyGroups.invite.errors.createFailed));
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyLink() {
    if (!latestShareUrl) return;
    void navigator.clipboard.writeText(latestShareUrl);
    toast.success(copy.familyGroups.invite.linkCopied);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setEmail("");
      setError("");
      setLatestShareUrl(null);
      setBadgeKey("");
      setCustomBadgeLabel("");
      setRole("viewer");
    }
    onOpenChange(nextOpen);
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.familyGroups.invite.title}
      description={copy.familyGroups.invite.description(groupTitle, reservedSlots, memberLimit)}
      icon={UserPlus}
      maxWidth="md"
    >
      <form
        id="family-group-invite-form"
        className="space-y-4 px-6 py-5"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="space-y-2">
          <Label htmlFor="family-invite-email">{copy.familyGroups.invite.emailLabel}</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="family-invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={copy.familyGroups.invite.emailPlaceholder}
              className="pl-9"
              required
              disabled={atCapacity}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{copy.familyGroups.invite.roleLabel}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as InvitableFamilyGroupRole)}>
              <SelectTrigger disabled={atCapacity}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">{copy.familyGroups.invite.roles.viewer}</SelectItem>
                <SelectItem value="contributor">{copy.familyGroups.invite.roles.contributor}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{copy.familyGroups.invite.badgeLabel}</Label>
            <Select value={badgeKey} onValueChange={setBadgeKey}>
              <SelectTrigger disabled={atCapacity}>
                <SelectValue placeholder={copy.familyGroups.invite.badgePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {badges.map((badge) => (
                  <SelectItem key={badge.key} value={badge.key}>
                    {badge.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {badgeKey === "custom" ? (
          <div className="space-y-2">
            <Label htmlFor="family-custom-badge">{copy.familyGroups.invite.customBadgeLabel}</Label>
            <Input
              id="family-custom-badge"
              value={customBadgeLabel}
              onChange={(event) => setCustomBadgeLabel(event.target.value)}
              maxLength={64}
              required
            />
          </div>
        ) : null}

        {latestShareUrl ? (
          <div className="rounded-[var(--radius-control)] border border-border bg-muted/15 p-3">
            <div className="flex items-start gap-2">
              <Link2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-foreground">
                  {copy.familyGroups.invite.linkReadyTitle}
                </p>
                <p className="mt-1 break-all text-[11px] text-muted-foreground">{latestShareUrl}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleCopyLink}>
              <Copy className="size-3.5" />
              {copy.familyGroups.invite.copyLink}
            </Button>
          </div>
        ) : null}

        {atCapacity ? (
          <p className="text-compact text-amber-700 dark:text-amber-200">
            {copy.familyGroups.invite.capacityReached(memberLimit)}
          </p>
        ) : null}

        {error ? <p className="text-compact text-destructive">{error}</p> : null}
      </form>

      <BrandDialogFooter>
        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
          {copy.familyGroups.form.cancel}
        </Button>
        <Button type="submit" form="family-group-invite-form" disabled={submitting || atCapacity || !email.trim()}>
          {copy.familyGroups.invite.submit}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
