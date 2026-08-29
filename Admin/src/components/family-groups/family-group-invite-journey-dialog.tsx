"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, UsersRound } from "lucide-react";

import { familyGroupsGroupHref } from "@/lib/admin-family-groups-navigation";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { KycField, KycFieldGrid } from "@/components/users/admin-user-kyc-panel-shared";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestampDetail } from "@/lib/format-date";
import {
  fetchAdminFamilyGroupInviteDetail,
  type AdminFamilyGroupInvite,
  type AdminFamilyGroupInviteDetail,
  type AdminFamilyGroupInviteJourneyEvent,
} from "@/lib/family-groups-admin-api";
import { cn } from "@/lib/utils";

type FamilyGroupInviteJourneyDialogProps = {
  open: boolean;
  inviteId: string | null;
  initialInvite?: AdminFamilyGroupInvite | null;
  onClose: () => void;
};

function titleCase(value: string | null | undefined) {
  if (!value) return null;
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function inviteVariant(status: string): "warning" | "success" | "neutral" | "destructive" | "info" {
  if (status === "pending") return "warning";
  if (status === "accepted") return "success";
  if (status === "declined" || status === "revoked") return "destructive";
  if (status === "expired") return "neutral";
  return "info";
}

function journeyDotClass(state: string, status: string) {
  if (status === "declined" || status === "revoked" || status === "expired") {
    return "border-destructive/40 bg-destructive/10";
  }
  if (state === "current") return "border-primary/40 bg-primary/10";
  if (state === "upcoming") return "border-border bg-muted/40";
  return "border-border bg-card";
}

function JourneyEventRow({
  event,
  isLast,
}: {
  event: AdminFamilyGroupInviteJourneyEvent;
  isLast: boolean;
}) {
  const isTerminal = ["declined", "revoked", "expired"].includes(event.status);

  return (
    <div className="flex gap-3">
      <div className="flex w-timeline-rail flex-col items-center self-stretch">
        <span
          className={cn(
            "relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full border",
            journeyDotClass(event.state, event.status),
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              isTerminal ? "bg-destructive" : event.state === "upcoming" ? "bg-muted-foreground/40" : "bg-primary",
            )}
          />
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
      </div>
      <div
        className={cn(
          "mb-5 min-w-0 flex-1 rounded-[var(--radius-control)] border px-3 py-3",
          isTerminal
            ? "border-destructive/35 bg-destructive/5"
            : event.state === "current"
              ? "border-primary/25 bg-primary/5"
              : "border-border/70 bg-muted/10",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{event.label}</p>
          <StatusBadge variant={inviteVariant(event.status)} showIcon={false}>
            {titleCase(event.status)}
          </StatusBadge>
        </div>
        <p className="mt-1.5 text-compact text-muted-foreground">{event.message}</p>
        {event.occurred_at ? (
          <p className="mt-2 text-caption text-muted-foreground">{formatTimestampDetail(event.occurred_at)}</p>
        ) : null}
      </div>
    </div>
  );
}

export function FamilyGroupInviteJourneyDialog({
  open,
  inviteId,
  initialInvite,
  onClose,
}: FamilyGroupInviteJourneyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<AdminFamilyGroupInviteDetail | null>(null);

  useEffect(() => {
    if (!open || !inviteId) {
      setDetail(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchAdminFamilyGroupInviteDetail(inviteId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null);
          setError(getErrorMessage(err, "Could not load this invite."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inviteId, open]);

  if (!open || !inviteId) return null;

  const invite = detail ?? initialInvite ?? null;
  const groupTitle = invite?.group_title ?? "Family group invite";

  return (
    <AdminDetailDialog
      open={open}
      onClose={onClose}
      title={groupTitle}
      description="Follow this invitation from send through accept, decline, revoke, or expiry."
      icon={Mail}
      iconTone="info"
      size="wide"
    >
      {loading && !invite ? (
        <AdminDetailDialogSkeleton />
      ) : error && !invite ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : invite ? (
        <div className="admin-user-investment-detail space-y-4">
          {error ? (
            <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
              {error}
            </AdminFeedbackMessage>
          ) : null}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{invite.invitee_email ?? "Unknown invitee"}</p>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {[titleCase(invite.intended_role), invite.intended_badge_label].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-2">
                <StatusBadge variant={inviteVariant(invite.status)} showIcon={false}>
                  {titleCase(invite.status)}
                </StatusBadge>
              </div>
            </div>
            {invite.group_id ? (
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                render={<Link href={familyGroupsGroupHref(invite.group_id)} />}
              >
                <UsersRound className="size-3.5" />
                View group
              </Button>
            ) : null}
          </div>

          <article className="admin-user-investment-detail__block">
            <div className="admin-user-investment-detail__block-head">
              <Mail className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              <span>Invite details</span>
            </div>
            <KycFieldGrid>
              <KycField label="Group" value={invite.group_title} />
              <KycField label="Group status" value={titleCase(invite.group_status)} />
              <KycField label="Invitee" value={detail?.invitee_display_name ?? invite.invitee_email} />
              <KycField label="Invitee email" value={invite.invitee_email} />
              <KycField label="Intended role" value={titleCase(invite.intended_role)} />
              <KycField label="Badge" value={invite.intended_badge_label} />
              <KycField
                label="Invited by"
                value={
                  detail?.invited_by_display_name
                    ? `${detail.invited_by_display_name}${
                        detail.invited_by_email_masked ? ` · ${detail.invited_by_email_masked}` : ""
                      }`
                    : null
                }
              />
              <KycField label="Created" value={formatTimestampDetail(invite.created_at)} />
              <KycField label="Expires" value={formatTimestampDetail(invite.expires_at)} />
              <KycField
                label="Accepted"
                value={detail?.accepted_at ? formatTimestampDetail(detail.accepted_at) : null}
              />
              <KycField
                label="Declined"
                value={detail?.declined_at ? formatTimestampDetail(detail.declined_at) : null}
              />
              <KycField
                label="Revoked"
                value={detail?.revoked_at ? formatTimestampDetail(detail.revoked_at) : null}
              />
              <KycField
                label="Reminders"
                value={
                  detail && detail.reminder_count > 0
                    ? `${detail.reminder_count}${
                        detail.reminder_sent_at ? ` · last ${formatTimestampDetail(detail.reminder_sent_at)}` : ""
                      }`
                    : null
                }
              />
              <KycField label="Accepted member" value={detail?.accepted_display_name} />
            </KycFieldGrid>
          </article>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-compact font-semibold text-foreground">Invite journey</p>
              <StatusBadge variant="neutral" showIcon={false}>
                {(detail?.journey.length ?? 0)} step{(detail?.journey.length ?? 0) === 1 ? "" : "s"}
              </StatusBadge>
            </div>
            {loading && !detail ? (
              <p className="admin-user-investment-detail__empty">Loading journey…</p>
            ) : (detail?.journey.length ?? 0) === 0 ? (
              <p className="admin-user-investment-detail__empty">No journey steps recorded yet.</p>
            ) : (
              <div>
                {detail?.journey.map((event, index) => (
                  <JourneyEventRow
                    key={event.id}
                    event={event}
                    isLast={index === (detail.journey.length ?? 0) - 1}
                  />
                ))}
              </div>
            )}
          </div>

          {detail && detail.activity.length > 0 ? (
            <article className="admin-user-investment-detail__block">
              <div className="admin-user-investment-detail__block-head">
                <UsersRound className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                <span>Related activity</span>
              </div>
              <div className="space-y-2">
                {detail.activity.map((item) => (
                  <div key={item.id} className="rounded-[var(--radius-control)] border border-border/70 px-3 py-2.5">
                    <p className="text-compact text-foreground">{item.message}</p>
                    <p className="mt-1 text-caption text-muted-foreground">
                      {formatTimestampDetail(item.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </AdminDetailDialog>
  );
}
