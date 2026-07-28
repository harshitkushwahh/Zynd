"use client";

import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
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
  addNomineeToFamilyGroup,
  previewNomineeFamilyGroupAdd,
  type NomineeFamilyGroupPreview,
} from "@/features/family-groups/api/family-groups-api";
import type { KycNomineeRecord } from "@/features/kyc/lib/kyc-nominee";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { toast } from "sonner";

type KycNomineeFamilyGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nominee: KycNomineeRecord | null;
  onCompleted: (result: "invited" | "skipped" | "blocked") => void;
};

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return copy.kyc.journeySaveFailed;
}

export function KycNomineeFamilyGroupDialog({
  open,
  onOpenChange,
  nominee,
  onCompleted,
}: KycNomineeFamilyGroupDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<NomineeFamilyGroupPreview | null>(null);
  const [error, setError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [createGroupTitle, setCreateGroupTitle] = useState("");

  useEffect(() => {
    if (!open || !nominee) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setPreview(null);
    setSelectedGroupId("");
    setCreateGroupTitle(`${nominee.core.fullName.split(" ")[0] ?? "Family"} Group`);

    void previewNomineeFamilyGroupAdd({
      nominee_email: nominee.contact.email.trim(),
      nominee_name: nominee.core.fullName.trim(),
      relationship: nominee.core.relationship,
      kyc_nominee_id: nominee.id,
    })
      .then((response) => {
        if (cancelled) return;
        setPreview(response);
        if (response.group_id) {
          setSelectedGroupId(response.group_id);
        } else if (response.groups.length === 1) {
          setSelectedGroupId(response.groups[0]!.id);
        }
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(resolveErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, nominee]);

  async function handleSkip() {
    if (!nominee) return;
    setSubmitting(true);
    setError("");
    try {
      await addNomineeToFamilyGroup({
        nominee_email: nominee.contact.email.trim(),
        nominee_name: nominee.core.fullName.trim(),
        relationship: nominee.core.relationship,
        kyc_nominee_id: nominee.id,
        action: "skip",
      });
      onOpenChange(false);
      onCompleted("skipped");
    } catch (submitError) {
      setError(resolveErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvite() {
    if (!nominee || !preview) return;
    setSubmitting(true);
    setError("");
    try {
      await addNomineeToFamilyGroup({
        nominee_email: nominee.contact.email.trim(),
        nominee_name: nominee.core.fullName.trim(),
        relationship: nominee.core.relationship,
        kyc_nominee_id: nominee.id,
        group_id: preview.status === "no_groups" ? undefined : selectedGroupId || preview.group_id || undefined,
        create_group_title: preview.status === "no_groups" ? createGroupTitle.trim() : undefined,
        action: "invite",
      });
      toast.success(copy.kyc.familyGroup.inviteSent);
      onOpenChange(false);
      onCompleted("invited");
    } catch (submitError) {
      setError(resolveErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  const blocked =
    preview &&
    ["already_member", "invite_pending", "group_full", "already_handled", "not_group_head"].includes(
      preview.status,
    );

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.kyc.familyGroup.title}
      description={copy.kyc.familyGroup.description}
      icon={UsersRound}
      maxWidth="md"
    >
      <div className="space-y-4 px-6 py-5">
        <p className="text-[11px] text-muted-foreground">{copy.kyc.familyGroup.legalDisclaimer}</p>

        {nominee ? (
          <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2.5">
            <p className="text-caption font-medium text-foreground">{nominee.core.fullName}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {copy.kyc.familyGroup.nomineeMeta(nominee.core.relationship, nominee.contact.email)}
            </p>
          </div>
        ) : null}

        {loading ? (
          <p className="text-compact text-muted-foreground">{copy.kyc.familyGroup.loading}</p>
        ) : preview ? (
          <div className="space-y-3">
            <p className="text-compact text-muted-foreground">{preview.message}</p>

            {preview.status === "no_groups" ? (
              <div className="space-y-2">
                <Label htmlFor="kyc-family-group-title">{copy.kyc.familyGroup.createGroupLabel}</Label>
                <Input
                  id="kyc-family-group-title"
                  value={createGroupTitle}
                  onChange={(event) => setCreateGroupTitle(event.target.value)}
                  maxLength={80}
                />
              </div>
            ) : null}

            {preview.status === "select_group" ? (
              <div className="space-y-2">
                <Label>{copy.kyc.familyGroup.selectGroupLabel}</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder={copy.kyc.familyGroup.selectGroupPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {preview.groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {preview.suggested_badge_label ? (
              <p className="text-[11px] text-muted-foreground">
                {copy.kyc.familyGroup.badgeHint(preview.suggested_badge_label)}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <FieldMessage message={error} className="mt-0" /> : null}
      </div>

      <BrandDialogFooter>
        <Button type="button" variant="outline" disabled={submitting} onClick={() => void handleSkip()}>
          {copy.kyc.familyGroup.skip}
        </Button>
        {blocked ? (
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onCompleted("blocked");
            }}
          >
            {copy.kyc.continue}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={
              submitting ||
              loading ||
              !preview ||
              (preview.status === "select_group" && !selectedGroupId) ||
              (preview.status === "no_groups" && !createGroupTitle.trim())
            }
            onClick={() => void handleInvite()}
          >
            {preview?.status === "no_groups"
              ? copy.kyc.familyGroup.createAndInvite
              : copy.kyc.familyGroup.inviteAction}
          </Button>
        )}
      </BrandDialogFooter>
    </BrandDialog>
  );
}
