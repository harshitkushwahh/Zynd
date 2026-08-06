"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";

import {
  AdminDetailDialog,
  AdminDialogFooterActions,
  AdminFormDialog,
} from "@/components/ui/admin-dialog-presets";
import { AdminDialogFooter } from "@/components/ui/admin-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  approveDistributorPartner,
  fetchDistributorPartner,
  rejectDistributorPartner,
  type AdminPendingDistributorPartner,
} from "@/lib/admin-distributor-partners-api";
import { DISTRIBUTOR_HEAD_QUEUE_APPROVE_PERMISSION } from "@/lib/admin-distributor-head-navigation";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";

type DistributorPartnerReviewDialogProps = {
  partnerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
};

function readPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNestedString(payload: Record<string, unknown>, section: string, key: string) {
  const sectionValue = payload[section];
  if (!sectionValue || typeof sectionValue !== "object" || Array.isArray(sectionValue)) return null;
  const value = (sectionValue as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-compact text-foreground">{value}</dd>
    </div>
  );
}

export function DistributorPartnerReviewDialog({
  partnerId,
  open,
  onOpenChange,
  onResolved,
}: DistributorPartnerReviewDialogProps) {
  const { hasPermission } = useAdminAuth();
  const canApprove = hasPermission(DISTRIBUTOR_HEAD_QUEUE_APPROVE_PERMISSION);

  const [partner, setPartner] = useState<AdminPendingDistributorPartner | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [arn, setArn] = useState("");
  const [euin, setEuin] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadPartner = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchDistributorPartner(partnerId);
      setPartner(result.partner);
      setArn(result.partner.arn || "");
      setEuin(result.partner.euin || "");
    } catch (err) {
      setPartner(null);
      setError(getErrorMessage(err, "Could not load application details."));
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (!open || !partnerId) {
      setPartner(null);
      setError("");
      setArn("");
      setEuin("");
      setRejectReason("");
      setRejectDialogOpen(false);
      return;
    }
    void loadPartner();
  }, [loadPartner, open, partnerId]);

  const handleApprove = async () => {
    if (!partner || !canApprove) return;
    const normalizedArn = arn.trim();
    if (!normalizedArn) {
      setError("Enter an ARN before approving.");
      return;
    }

    setActionLoading(true);
    setError("");
    try {
      await approveDistributorPartner(partner.id, {
        arn: normalizedArn,
        euin: euin.trim() || undefined,
      });
      onOpenChange(false);
      onResolved?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not approve application."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!partner || !canApprove) return;
    const reason = rejectReason.trim();
    if (reason.length < 4) {
      setError("Enter a rejection reason of at least 4 characters.");
      return;
    }

    setActionLoading(true);
    setError("");
    try {
      await rejectDistributorPartner(partner.id, reason);
      setRejectDialogOpen(false);
      onOpenChange(false);
      onResolved?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not reject application."));
    } finally {
      setActionLoading(false);
    }
  };

  const payload = partner?.profile_payload ?? {};
  const panVerifiedName = readPayloadString(payload, "pan_verified_name");
  const bankName = readNestedString(payload, "bank", "bank_name");
  const branchName = readNestedString(payload, "bank", "branch_name");
  const accountMasked = readNestedString(payload, "bank", "account_number_masked");
  const city = readNestedString(payload, "address", "city");
  const state = readNestedString(payload, "address", "state");

  return (
    <>
      <AdminDetailDialog
        open={open}
        onOpenChange={onOpenChange}
        title={partner?.name ?? "Zynd Mitra application"}
        description={
          partner
            ? `${partner.email}${partner.created_at ? ` · Submitted ${formatTimestampDetail(partner.created_at)}` : ""}`
            : "Review onboarding details before HO approval."
        }
        icon={ClipboardList}
        iconTone="info"
        footer={
          canApprove ? (
            <AdminDialogFooter className="flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid w-full gap-3 sm:max-w-md sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="partner-review-arn">ARN</Label>
                  <Input
                    id="partner-review-arn"
                    placeholder="ARN"
                    value={arn}
                    disabled={loading || actionLoading || !partner}
                    onChange={(event) => setArn(event.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner-review-euin">EUIN (optional)</Label>
                  <Input
                    id="partner-review-euin"
                    placeholder="EUIN"
                    value={euin}
                    disabled={loading || actionLoading || !partner}
                    onChange={(event) => setEuin(event.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <AdminDialogFooterActions
                cancelLabel="Close"
                confirmLabel="Approve & send password email"
                loading={actionLoading}
                confirmDisabled={!partner || !arn.trim()}
                onCancel={() => onOpenChange(false)}
                onConfirm={() => void handleApprove()}
              />
            </AdminDialogFooter>
          ) : undefined
        }
      >
        {loading ? <AdminDetailDialogSkeleton /> : null}
        {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

        {!loading && partner ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant="warning">Pending HO review</StatusBadge>
              {partner.pan_masked ? (
                <span className="font-mono text-caption text-muted-foreground">{partner.pan_masked}</span>
              ) : null}
            </div>

            {partner.profile_image_url ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={partner.profile_image_url}
                  alt=""
                  className="size-16 rounded-full border border-border object-cover"
                />
                <div>
                  <p className="font-medium text-foreground">{partner.name}</p>
                  <p className="text-caption text-muted-foreground">{partner.email}</p>
                </div>
              </div>
            ) : null}

            <dl className="grid gap-4 sm:grid-cols-2">
              <ProfileField label="Email" value={partner.email} />
              <ProfileField label="Phone" value={partner.phone} />
              <ProfileField label="PAN verified name" value={panVerifiedName} />
              <ProfileField label="City" value={city} />
              <ProfileField label="State" value={state} />
              <ProfileField label={MITRA_HIERARCHY_COPY.branchManager} value={partner.manager_name} />
              <ProfileField label="Branch" value={partner.branch_name ?? branchName} />
              <ProfileField label="Bank" value={bankName} />
              <ProfileField label="Bank branch" value={branchName} />
              <ProfileField label="Account" value={accountMasked} />
            </dl>

            {canApprove ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  className="text-compact text-destructive underline-offset-4 hover:underline"
                  disabled={actionLoading}
                  onClick={() => {
                    setRejectReason("");
                    setRejectDialogOpen(true);
                  }}
                >
                  Reject application
                </button>
              </div>
            ) : (
              <AdminFeedbackMessage variant="warning">
                You can view this application but do not have permission to approve or reject it.
              </AdminFeedbackMessage>
            )}
          </div>
        ) : null}
      </AdminDetailDialog>

      <AdminFormDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        title="Reject application"
        description="Provide a reason for the applicant and compliance records. Minimum 4 characters."
        icon={ClipboardList}
        iconTone="destructive"
        footer={
          <AdminDialogFooter>
            <AdminDialogFooterActions
              cancelLabel="Cancel"
              confirmLabel="Reject application"
              confirmVariant="destructive"
              loading={actionLoading}
              confirmDisabled={rejectReason.trim().length < 4}
              onCancel={() => setRejectDialogOpen(false)}
              onConfirm={() => void handleReject()}
            />
          </AdminDialogFooter>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="partner-reject-reason">Reason for rejection</Label>
          <textarea
            id="partner-reject-reason"
            rows={4}
            placeholder="Explain why this application cannot be approved"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            className="flex min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-compact text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-caption text-muted-foreground">
            {rejectReason.trim().length}/512 characters
          </p>
        </div>
      </AdminFormDialog>
    </>
  );
}
