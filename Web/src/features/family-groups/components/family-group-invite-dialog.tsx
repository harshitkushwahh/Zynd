"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Mail, Send, UserPlus, Users } from "lucide-react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
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
import { cn } from "@/lib/utils";
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

type InviteDialogStep = "intro" | "form";

const INVITE_STEPS: InviteDialogStep[] = ["intro", "form"];

const INVITE_INTRO_STEP_ICONS = [UserPlus, Send, Users] as const;

function InviteDialogProgress({ step, compact = false }: { step: InviteDialogStep; compact?: boolean }) {
  const currentIndex = INVITE_STEPS.indexOf(step);

  return (
    <div
      className={cn("flex gap-1.5", compact ? "mb-2" : "mb-5")}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={INVITE_STEPS.length}
      aria-valuenow={currentIndex + 1}
      aria-label={copy.familyGroups.invite.title}
    >
      {INVITE_STEPS.map((item, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div
            key={item}
            className={cn(
              "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
              done && "bg-success",
              active && "bg-primary",
              !done && !active && "bg-border",
            )}
          />
        );
      })}
    </div>
  );
}

function InviteIntroStep({ onContinue }: { onContinue: () => void }) {
  const inviteCopy = copy.familyGroups.invite;

  return (
    <div className="space-y-5">
      <ul className="space-y-2.5">
        {inviteCopy.introSteps.map((point, index) => {
          const Icon = INVITE_INTRO_STEP_ICONS[index] ?? UserPlus;
          return (
            <li key={point} className="flex items-start gap-2.5 text-[11px] leading-snug text-muted-foreground sm:text-caption">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-3" strokeWidth={2.5} aria-hidden />
              </span>
              {point}
            </li>
          );
        })}
      </ul>

      <AuthSubmitFooter className="pt-0">
        <Button type="button" className="w-full" onClick={onContinue}>
          {copy.mfa.continue}
        </Button>
      </AuthSubmitFooter>
    </div>
  );
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
  const queryClient = useQueryClient();
  const [step, setStep] = useState<InviteDialogStep>("intro");
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

  const reset = useCallback(() => {
    setStep("intro");
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
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.familyGroups.invite.title}
      maxWidth="lg"
      headerAction={
        <Badge variant="secondary" className="font-normal tabular-nums">
          {reservedSlots}/{memberLimit}
        </Badge>
      }
    >
      <div className="px-5 pb-5 pt-1.5">
        <InviteDialogProgress step={step} compact={step !== "intro"} />

        {step === "intro" ? <FamilyGroupInviteHeroImage className="mb-4" /> : null}

        {step === "intro" ? (
          <InviteIntroStep onContinue={() => setStep("form")} />
        ) : (
          <form id="family-group-invite-form" className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 p-4 space-y-4">
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
                    className="h-9 bg-background pl-9"
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
                    <SelectTrigger id="family-invite-role" className="h-9 w-full bg-background" disabled={atCapacity}>
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
                  <SelectTrigger id="family-invite-badge" className="h-9 w-full bg-background" disabled={atCapacity}>
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
                    className="h-9 bg-background"
                    maxLength={FAMILY_GROUP_LIMITS.customBadgeMax}
                    required
                    aria-invalid={Boolean(fieldErrors.customBadgeLabel)}
                  />
                  {fieldErrors.customBadgeLabel ? (
                    <FieldMessage message={fieldErrors.customBadgeLabel} />
                  ) : null}
                </div>
              ) : null}
            </div>

            {latestShareUrl ? (
              <div className="rounded-[var(--radius-control)] border border-success/25 bg-success/5 p-3.5">
                <div className="flex items-start gap-2.5">
                  <Link2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="text-compact font-medium text-foreground">
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

            <AuthSubmitFooter className="pt-1">
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || atCapacity || !email.trim()}
              >
                {copy.familyGroups.invite.submit}
              </Button>
            </AuthSubmitFooter>
          </form>
        )}
      </div>
    </BrandDialog>
  );
}
