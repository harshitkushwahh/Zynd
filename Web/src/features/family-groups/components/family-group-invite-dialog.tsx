"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Mail, Send, Tag, UserRound, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SplitFormDialog } from "@/components/ui/split-form-dialog";
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
import { FamilyGroupInviteHeroImage } from "@/features/family-groups/components/family-group-invite-hero-image";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import {
  FAMILY_GROUP_LIMITS,
  hasFamilyGroupFormErrors,
  validateInviteForm,
  type FamilyGroupFormFieldErrors,
} from "@/features/family-groups/lib/family-group-validation";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
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

const INTRO_POINT_ICONS = [
  { icon: Mail, iconClassName: "bg-primary/10 text-primary" },
  { icon: Send, iconClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  { icon: Users, iconClassName: "bg-success/10 text-success" },
] as const;

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
  const inviteCopy = copy.familyGroups.invite;
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
  const selectedBadge = badges.find((badge) => badge.key === badgeKey);
  const badgeDisplay =
    badgeKey === "custom"
      ? customBadgeLabel.trim() || inviteCopy.customBadgeLabel
      : selectedBadge?.label || inviteCopy.badgePlaceholder;
  const roleLabel =
    role === "contributor" ? inviteCopy.roles.contributor : inviteCopy.roles.viewer;

  const reset = useCallback(() => {
    setEmail("");
    setRole("viewer");
    setBadgeKey("");
    setCustomBadgeLabel("");
    setError("");
    setFieldErrors({});
    setLatestShareUrl(null);
    setSubmitting(false);
  }, []);

  useResetWhenDialogOpens(open, reset);

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
      toast.success(inviteCopy.successTitle);
      setEmail("");
      setCustomBadgeLabel("");
      setFieldErrors({});
    } catch (submitError) {
      setError(resolveFamilyGroupApiError(submitError, inviteCopy.errors.createFailed));
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyLink() {
    if (!latestShareUrl) return;
    void navigator.clipboard.writeText(latestShareUrl);
    toast.success(inviteCopy.linkCopied);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  const points = inviteCopy.introPoints.map((point, index) => ({
    ...point,
    icon: INTRO_POINT_ICONS[index]?.icon ?? Mail,
    iconClassName: INTRO_POINT_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
  }));

  return (
    <SplitFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={inviteCopy.title}
      illustration={<FamilyGroupInviteHeroImage className="w-full max-w-sm" />}
      points={points}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            {copy.familyGroups.form.cancel}
          </Button>
          <Button
            type="submit"
            form="family-group-invite-form"
            className="h-11 rounded-full px-5"
            disabled={submitting || atCapacity || !email.trim()}
          >
            {inviteCopy.submit}
          </Button>
        </>
      }
    >
      <form
        id="family-group-invite-form"
        className="flex min-h-full min-w-0 flex-1 flex-col gap-5"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="min-w-0 space-y-2">
          <Label htmlFor="family-invite-email">{inviteCopy.emailLabel}</Label>
          <div className="relative min-w-0">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="family-invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={inviteCopy.emailPlaceholder}
              className="h-11 w-full min-w-0 max-w-full bg-background pl-9"
              required
              disabled={atCapacity}
              autoFocus
              aria-invalid={Boolean(fieldErrors.email)}
            />
          </div>
          {fieldErrors.email ? <FieldMessage message={fieldErrors.email} /> : null}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="family-invite-role">{inviteCopy.roleLabel}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as InvitableFamilyGroupRole)}>
              <SelectTrigger id="family-invite-role" className="h-11 w-full min-w-0 bg-background" disabled={atCapacity}>
                <SelectValue>{roleLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">{inviteCopy.roles.viewer}</SelectItem>
                <SelectItem value="contributor">{inviteCopy.roles.contributor}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor="family-invite-badge">{inviteCopy.badgeLabel}</Label>
            <Select value={badgeKey} onValueChange={(value) => setBadgeKey(value ?? "")}>
              <SelectTrigger id="family-invite-badge" className="h-11 w-full min-w-0 bg-background" disabled={atCapacity}>
                <SelectValue placeholder={inviteCopy.badgePlaceholder} />
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
          <div className="min-w-0 space-y-2">
            <Label htmlFor="family-custom-badge">{inviteCopy.customBadgeLabel}</Label>
            <Input
              id="family-custom-badge"
              value={customBadgeLabel}
              onChange={(event) => setCustomBadgeLabel(event.target.value)}
              placeholder={inviteCopy.customBadgeLabel}
              className="h-11 w-full min-w-0 max-w-full bg-background"
              maxLength={FAMILY_GROUP_LIMITS.customBadgeMax}
              required
              aria-invalid={Boolean(fieldErrors.customBadgeLabel)}
            />
            {fieldErrors.customBadgeLabel ? <FieldMessage message={fieldErrors.customBadgeLabel} /> : null}
          </div>
        ) : null}

        {latestShareUrl ? (
          <div className="rounded-[var(--radius-control)] border border-success/25 bg-success/5 p-3.5">
            <div className="flex items-start gap-2.5">
              <Link2 className="mt-0.5 size-4 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="text-compact font-medium text-foreground">{inviteCopy.linkReadyTitle}</p>
                <p className="mt-1 break-all text-caption text-muted-foreground">{latestShareUrl}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleCopyLink}>
              <Copy className="size-3.5" />
              {inviteCopy.copyLink}
            </Button>
          </div>
        ) : null}

        <div className="flex min-h-36 flex-1 flex-col justify-end">
          <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-4" strokeWidth={2.25} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-caption text-muted-foreground">{inviteCopy.title}</p>
                <p className="truncate text-compact font-semibold text-foreground">{groupTitle}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {inviteCopy.slotsBadge(reservedSlots, memberLimit)}
              </Badge>
            </div>
            <div className="mt-4 border-t border-border/70 pt-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                  <Mail className="size-3.5" strokeWidth={2.25} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-caption text-muted-foreground">{inviteCopy.emailLabel}</p>
                  <p className="mt-0.5 break-all text-compact font-medium text-foreground">
                    {email.trim() || inviteCopy.emailPlaceholder}
                  </p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { icon: UserRound, label: inviteCopy.roleLabel, value: roleLabel },
                  { icon: Tag, label: inviteCopy.badgeLabel, value: badgeDisplay },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="min-w-0 rounded-lg border border-border/70 bg-background px-3 py-2.5">
                      <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
                        <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                        {item.label}
                      </dt>
                      <dd className="mt-1 break-words text-compact font-semibold text-foreground">{item.value}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>
        </div>

        {atCapacity ? (
          <p className="text-compact text-amber-700 dark:text-amber-200">{inviteCopy.capacityReached(memberLimit)}</p>
        ) : null}

        {error ? <FieldMessage message={error} className="mt-0" /> : null}
      </form>
    </SplitFormDialog>
  );
}
