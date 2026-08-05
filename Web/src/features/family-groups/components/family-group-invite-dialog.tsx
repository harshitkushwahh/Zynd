"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Mail, UserPlus } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
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
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import {
  FAMILY_GROUP_LIMITS,
  hasFamilyGroupFormErrors,
  validateInviteForm,
  type FamilyGroupFormFieldErrors,
} from "@/features/family-groups/lib/family-group-validation";
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
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableFamilyGroupRole>("viewer");
  const [badgeKey, setBadgeKey] = useState<string>("");
  const [customBadgeLabel, setCustomBadgeLabel] = useState("");
  const [badges, setBadges] = useState<FamilyGroupBadgePreset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FamilyGroupFormFieldErrors>({});
  const [latestShareUrl, setLatestShareUrl] = useState<string | null>(null);

  const reservedSlots = memberCount + pendingInviteCount;
  const atCapacity = reservedSlots >= memberLimit;
  const roleLabel =
    role === "contributor"
      ? copy.familyGroups.invite.roles.contributor
      : copy.familyGroups.invite.roles.viewer;

  useEffect(() => {
    if (!open) return;
    void fetchFamilyGroupBadges()
      .then((response) => setBadges(response.items))
      .catch(() => setBadges([]));
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (atCapacity) return;

    const validation = validateInviteForm({ email, badgeKey, customBadgeLabel });
    setFieldErrors(validation);
    if (hasFamilyGroupFormErrors(validation)) return;

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
      await invalidateFamilyQueries(queryClient, groupId);
      onInviteCreated?.(invite);
      toast.success(copy.familyGroups.invite.successTitle);
      setEmail("");
      setCustomBadgeLabel("");
      setFieldErrors({});
    } catch (submitError) {
      setError(resolveFamilyGroupApiError(submitError, copy.familyGroups.invite.errors.createFailed));
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
      setFieldErrors({});
    }
    onOpenChange(nextOpen);
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.familyGroups.invite.title}
      description={copy.familyGroups.invite.description(groupTitle)}
      icon={UserPlus}
      maxWidth="md"
      headerAction={
        <Badge
          variant="secondary"
          className="border-primary-foreground/20 bg-primary-foreground/10 font-normal tabular-nums text-primary-foreground"
        >
          {reservedSlots}/{memberLimit}
        </Badge>
      }
    >
      <form
        id="family-group-invite-form"
        className="space-y-5 px-6 py-5"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="grid grid-cols-1 gap-y-2 gap-x-4 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
          <Label htmlFor="family-invite-email" className="sm:col-start-1 sm:row-start-1">
            {copy.familyGroups.invite.emailLabel}
          </Label>
          <div className="relative sm:col-start-1 sm:row-start-2">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="family-invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={copy.familyGroups.invite.emailPlaceholder}
              className="h-9 pl-9"
              required
              disabled={atCapacity}
              aria-invalid={Boolean(fieldErrors.email)}
            />
          </div>
          {fieldErrors.email ? <FieldMessage message={fieldErrors.email} /> : null}

          <Label htmlFor="family-invite-role" className="mt-2 sm:col-start-2 sm:row-start-1 sm:mt-0">
            {copy.familyGroups.invite.roleLabel}
          </Label>
          <div className="sm:col-start-2 sm:row-start-2">
            <Select
              value={role}
              onValueChange={(value) => setRole(value as InvitableFamilyGroupRole)}
            >
              <SelectTrigger id="family-invite-role" className="h-9 w-full" disabled={atCapacity}>
                <SelectValue>{roleLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">{copy.familyGroups.invite.roles.viewer}</SelectItem>
                <SelectItem value="contributor">{copy.familyGroups.invite.roles.contributor}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="family-invite-badge">{copy.familyGroups.invite.badgeLabel}</Label>
          <Select value={badgeKey} onValueChange={setBadgeKey}>
            <SelectTrigger id="family-invite-badge" className="h-9 w-full" disabled={atCapacity}>
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

        {badgeKey === "custom" ? (
          <div className="space-y-2">
            <Label htmlFor="family-custom-badge">{copy.familyGroups.invite.customBadgeLabel}</Label>
            <Input
              id="family-custom-badge"
              value={customBadgeLabel}
              onChange={(event) => setCustomBadgeLabel(event.target.value)}
              placeholder={copy.familyGroups.invite.customBadgeLabel}
              maxLength={FAMILY_GROUP_LIMITS.customBadgeMax}
              required
              aria-invalid={Boolean(fieldErrors.customBadgeLabel)}
            />
            {fieldErrors.customBadgeLabel ? (
              <FieldMessage message={fieldErrors.customBadgeLabel} />
            ) : null}
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

        {error ? <FieldMessage message={error} className="mt-0" /> : null}
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
