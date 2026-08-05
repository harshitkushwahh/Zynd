"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Crown, Trash2, UsersRound, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  fetchFamilyGroupBadges,
  removeFamilyGroupMember,
  transferFamilyGroupHead,
  updateFamilyGroupMember,
  type FamilyGroupBadgePreset,
  type FamilyGroupMemberPreview,
  type FamilyGroupRole,
  type InvitableFamilyGroupRole,
} from "@/features/family-groups/api/family-groups-api";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import { FamilyMemberRoleBadge } from "@/features/family-groups/components/family-member-role-badge";
import {
  canEditMember,
  canEditNickname,
  canRemoveMember,
  canTransferHeadToMember,
} from "@/features/family-groups/lib/family-permissions";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import {
  FAMILY_GROUP_LIMITS,
  hasFamilyGroupFormErrors,
  validateCustomBadgeLabel,
  validateMemberNickname,
  type FamilyGroupFormFieldErrors,
} from "@/features/family-groups/lib/family-group-validation";
import {
  FAMILY_GROUP_CARD_RADIUS_CLASS,
  formatFamilyMemberDetailValue,
} from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupMemberRowProps = {
  groupId: string;
  member: FamilyGroupMemberPreview;
  myRole?: FamilyGroupRole | null;
  currentUserId: string;
  onUpdated: () => void;
  onError: (message: string) => void;
};

function MemberAvatar({ member }: { member: FamilyGroupMemberPreview }) {
  return (
    <div className="relative shrink-0">
      <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-1 ring-border/60">
        {member.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.profile_image_url} alt="" className="size-full object-cover" />
        ) : (
          <UsersRound className="size-4" strokeWidth={2} />
        )}
      </div>
      {member.role === "head" ? (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-card">
          <Crown className="size-2" strokeWidth={2.25} />
        </span>
      ) : null}
    </div>
  );
}

function MemberDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-compact text-foreground">{value}</p>
    </div>
  );
}

function MemberDetailBadgeItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function MemberStatusBadge({ label, positive }: { label: string; positive: boolean }) {
  return (
    <StatusBadge
      variant={positive ? "success" : "neutral"}
      icon={positive ? CheckCircle2 : XCircle}
      className="h-auto max-w-full px-2 py-1 text-[10px] font-semibold"
    >
      <span className="truncate">{label}</span>
    </StatusBadge>
  );
}

export function MemberDetailsGrid({ member }: { member: FamilyGroupMemberPreview }) {
  const detailsCopy = copy.familyGroups.dashboard.memberDetails;
  const masked = member.details_masked === true;
  const empty = detailsCopy.emptyValue;

  const kycValue = member.kyc_completed ? detailsCopy.kycCompleted : detailsCopy.kycPending;
  const investedValue = member.has_invested ? detailsCopy.investedYes : detailsCopy.investedNo;
  const contributionValue = masked
    ? detailsCopy.maskedValue
    : member.contribution_amount == null
      ? detailsCopy.contributionComingSoon
      : formatFamilyMemberDetailValue(member.contribution_amount, { empty });
  const groupSipsValue = masked
    ? detailsCopy.maskedValue
    : formatFamilyMemberDetailValue(member.group_sip_count, { empty });

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/60 px-3 py-3 sm:grid-cols-4">
      <MemberDetailItem
        label={detailsCopy.emailLabel}
        value={formatFamilyMemberDetailValue(member.email, { empty })}
      />
      <MemberDetailItem
        label={detailsCopy.zyndIdLabel}
        value={formatFamilyMemberDetailValue(member.zynd_id, { empty })}
      />
      <MemberDetailItem
        label={detailsCopy.mobileLabel}
        value={formatFamilyMemberDetailValue(member.phone, { empty })}
      />
      <MemberDetailBadgeItem label={detailsCopy.kycLabel}>
        <MemberStatusBadge label={kycValue} positive={member.kyc_completed === true} />
      </MemberDetailBadgeItem>
      <MemberDetailBadgeItem label={detailsCopy.investedLabel}>
        <MemberStatusBadge label={investedValue} positive={member.has_invested === true} />
      </MemberDetailBadgeItem>
      <MemberDetailBadgeItem label={detailsCopy.badgeLabel}>
        <FamilyMemberRoleBadge role={member.role} badgeLabel={member.badge_label} />
      </MemberDetailBadgeItem>
      <MemberDetailItem label={detailsCopy.contributionLabel} value={contributionValue} />
      <MemberDetailItem label={detailsCopy.groupSipsLabel} value={groupSipsValue} />
    </div>
  );
}

function MemberAccordionLabel({
  member,
  currentUserId,
  open,
}: {
  member: FamilyGroupMemberPreview;
  currentUserId: string;
  open?: boolean;
}) {
  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MemberAvatar member={member} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-caption font-semibold text-foreground">{member.display_name}</p>
            {currentUserId === member.user_id ? (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-primary">
                {copy.familyGroups.dashboard.orbitMemberDetail.youLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <FamilyMemberRoleBadge
        role={member.role}
        badgeLabel={member.badge_label}
        className="shrink-0"
      />
      {open !== undefined ? (
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
            open && "rotate-180",
          )}
          aria-hidden
        />
      ) : null}
    </>
  );
}

export function FamilyGroupMemberRow({
  groupId,
  member,
  myRole,
  currentUserId,
  onUpdated,
  onError,
}: FamilyGroupMemberRowProps) {
  const queryClient = useQueryClient();
  const panelId = useId();
  const editable = canEditMember(myRole, member.role, currentUserId, member.user_id);
  const nicknameEditable = canEditNickname(myRole, currentUserId, member.user_id);
  const removable = canRemoveMember(myRole, member.role, currentUserId, member.user_id);
  const transferable = canTransferHeadToMember(myRole, member.role, currentUserId, member.user_id);
  const expandable = editable || nicknameEditable || transferable || removable;

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<InvitableFamilyGroupRole>(
    member.role === "head" ? "contributor" : member.role,
  );
  const [badgeKey, setBadgeKey] = useState(member.badge_key ?? "");
  const [customBadgeLabel, setCustomBadgeLabel] = useState(
    member.badge_key === "custom" ? member.badge_label ?? "" : "",
  );
  const [nickname, setNickname] = useState(member.display_nickname ?? "");
  const [badges, setBadges] = useState<FamilyGroupBadgePreset[]>([]);
  const [saving, setSaving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FamilyGroupFormFieldErrors>({});

  useEffect(() => {
    setRole(member.role === "head" ? "contributor" : member.role);
    setBadgeKey(member.badge_key ?? "");
    setCustomBadgeLabel(member.badge_key === "custom" ? member.badge_label ?? "" : "");
    setNickname(member.display_nickname ?? "");
  }, [member]);

  useEffect(() => {
    if (!editable) return;
    void fetchFamilyGroupBadges()
      .then((response) => setBadges(response.items))
      .catch(() => setBadges([]));
  }, [editable]);

  const roleChanged = member.role !== "head" && role !== member.role;
  const badgeChanged =
    (badgeKey || "") !== (member.badge_key ?? "") ||
    (badgeKey === "custom" && customBadgeLabel.trim() !== (member.badge_label ?? ""));
  const nicknameChanged = nickname.trim() !== (member.display_nickname ?? "");
  const hasPendingChanges = roleChanged || badgeChanged || nicknameChanged;

  async function handleSave() {
    const errors: FamilyGroupFormFieldErrors = {};
    if (badgeKey === "custom") {
      errors.customBadgeLabel = validateCustomBadgeLabel(customBadgeLabel);
    }
    if (nicknameChanged) {
      errors.nickname = validateMemberNickname(nickname);
    }
    setFieldErrors(errors);
    if (hasFamilyGroupFormErrors(errors)) return;

    setSaving(true);
    try {
      const input: Parameters<typeof updateFamilyGroupMember>[2] = {};
      if (roleChanged) input.role = role;
      if (badgeChanged) {
        if (!badgeKey) {
          input.clear_badge = true;
        } else {
          input.badge_key = badgeKey;
          if (badgeKey === "custom") {
            input.badge_label = customBadgeLabel.trim();
          }
        }
      }
      if (nicknameChanged) {
        if (!nickname.trim()) {
          input.clear_nickname = true;
        } else {
          input.display_nickname = nickname.trim();
        }
      }
      await updateFamilyGroupMember(groupId, member.user_id, input);
      await invalidateFamilyQueries(queryClient, groupId);
      onUpdated();
      setFieldErrors({});
    } catch (error) {
      onError(resolveFamilyGroupApiError(error, copy.familyGroups.governance.errors.updateFailed));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setActing(true);
    try {
      await removeFamilyGroupMember(groupId, member.user_id);
      setRemoveOpen(false);
      await invalidateFamilyQueries(queryClient, groupId);
      onUpdated();
    } catch (error) {
      onError(resolveFamilyGroupApiError(error, copy.familyGroups.governance.errors.removeFailed));
      setRemoveOpen(false);
    } finally {
      setActing(false);
    }
  }

  async function handleTransferHead() {
    setActing(true);
    try {
      await transferFamilyGroupHead(groupId, { new_head_user_id: member.user_id });
      setTransferOpen(false);
      await invalidateFamilyQueries(queryClient, groupId);
      onUpdated();
    } catch (error) {
      onError(resolveFamilyGroupApiError(error, copy.familyGroups.governance.errors.transferFailed));
      setTransferOpen(false);
    } finally {
      setActing(false);
    }
  }

  if (!expandable) {
    return (
      <div className={cn("w-full min-w-0 overflow-hidden border border-border bg-card shadow-zynd-low", FAMILY_GROUP_CARD_RADIUS_CLASS)}>
        <div className="flex items-center gap-3 px-3 py-3">
          <MemberAccordionLabel member={member} currentUserId={currentUserId} />
        </div>
        <MemberDetailsGrid member={member} />
      </div>
    );
  }

  return (
    <>
      <div className={cn("w-full min-w-0 overflow-hidden border border-border bg-card shadow-zynd-low", FAMILY_GROUP_CARD_RADIUS_CLASS)}>
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <MemberAccordionLabel member={member} currentUserId={currentUserId} open={open} />
        </button>

        <MemberDetailsGrid member={member} />

        <div
          className={cn(
            "grid w-full min-w-0 transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 min-w-0 overflow-hidden">
            <div
              id={panelId}
              className={cn(
                "w-full min-w-0 space-y-4 border-t border-border/60 px-3 pb-3 pt-3 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                open ? "opacity-100" : "opacity-0",
              )}
            >
              {(editable || nicknameEditable) && (
                <div className="space-y-4">
                  {editable ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="min-w-0 space-y-1.5">
                        <Label htmlFor={`${panelId}-role`}>{copy.familyGroups.governance.roleLabel}</Label>
                        <Select value={role} onValueChange={(value) => setRole(value as InvitableFamilyGroupRole)}>
                          <SelectTrigger id={`${panelId}-role`} className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">{copy.familyGroups.invite.roles.viewer}</SelectItem>
                            <SelectItem value="contributor">{copy.familyGroups.invite.roles.contributor}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label htmlFor={`${panelId}-badge`}>{copy.familyGroups.governance.badgeLabel}</Label>
                        <Select
                          value={badgeKey || "none"}
                          onValueChange={(value) => setBadgeKey(value === "none" ? "" : value)}
                        >
                          <SelectTrigger id={`${panelId}-badge`} className="h-9 w-full">
                            <SelectValue placeholder={copy.familyGroups.invite.badgePlaceholder} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{copy.familyGroups.invite.badgePlaceholder}</SelectItem>
                            {badges.map((badge) => (
                              <SelectItem key={badge.key} value={badge.key}>
                                {badge.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {badgeKey === "custom" ? (
                          <>
                            <Input
                              value={customBadgeLabel}
                              onChange={(event) => setCustomBadgeLabel(event.target.value)}
                              placeholder={copy.familyGroups.invite.customBadgeLabel}
                              maxLength={FAMILY_GROUP_LIMITS.customBadgeMax}
                              className="h-9 w-full"
                              aria-invalid={Boolean(fieldErrors.customBadgeLabel)}
                            />
                            {fieldErrors.customBadgeLabel ? (
                              <FieldMessage message={fieldErrors.customBadgeLabel} />
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {nicknameEditable ? (
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor={`${panelId}-nickname`}>{copy.familyGroups.governance.nicknameLabel}</Label>
                      <Input
                        id={`${panelId}-nickname`}
                        value={nickname}
                        onChange={(event) => setNickname(event.target.value)}
                        placeholder={copy.familyGroups.governance.nicknamePlaceholder}
                        maxLength={FAMILY_GROUP_LIMITS.nicknameMax}
                        className="h-9 w-full"
                        aria-invalid={Boolean(fieldErrors.nickname)}
                      />
                      {fieldErrors.nickname ? (
                        <FieldMessage message={fieldErrors.nickname} />
                      ) : null}
                    </div>
                  ) : null}

                  {hasPendingChanges ? (
                    <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
                      {copy.familyGroups.governance.saveMember}
                    </Button>
                  ) : null}
                </div>
              )}

              {transferable || removable ? (
                <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  {transferable ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                      <Crown className="size-3.5" strokeWidth={2} />
                      {copy.familyGroups.governance.transferHeadAction}
                    </Button>
                  ) : null}
                  {removable ? (
                    <Button type="button" size="sm" variant="destructive" onClick={() => setRemoveOpen(true)}>
                      <Trash2 className="size-3.5" strokeWidth={2} />
                      {copy.familyGroups.governance.removeAction}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        variant="destructive"
        title={copy.familyGroups.governance.removeConfirmTitle}
        description={copy.familyGroups.governance.removeConfirmDescription(member.display_name)}
        confirmLabel={copy.familyGroups.governance.removeAction}
        loading={acting}
        onConfirm={() => void handleRemove()}
      />

      <ConfirmDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title={copy.familyGroups.governance.transferHeadConfirmTitle}
        description={copy.familyGroups.governance.transferHeadConfirmDescription(member.display_name)}
        confirmLabel={copy.familyGroups.governance.transferHeadAction}
        loading={acting}
        onConfirm={() => void handleTransferHead()}
      />
    </>
  );
}
