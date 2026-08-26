"use client";

import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { AdminUserKycDetailTabs } from "@/components/users/admin-user-kyc-detail-tabs";
import { AdminUserKycJourneySection } from "@/components/users/admin-user-kyc-journey-section";
import { AdminUserKycOverviewMetrics } from "@/components/users/admin-user-kyc-overview-metrics";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { fetchAdminDocumentDownload, type AdminUserKycDetail } from "@/lib/admin-api";

export function UserKycDetailSection({
  kyc,
  hasDownload,
}: {
  kyc: AdminUserKycDetail;
  hasDownload: boolean;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const signatureDocumentId =
    kyc.signature_document_id ??
    kyc.documents.find((document) => document.doc_type === "signature")?.id ??
    null;

  const handlePreview = async (documentId: string) => {
    if (!hasDownload) return;
    setActionLoading(`preview-${documentId}`);
    setError("");
    try {
      const payload = await fetchAdminDocumentDownload(documentId);
      window.open(payload.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(getErrorMessage(err, "Could not open document."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <AdminUserKycOverviewMetrics kyc={kyc} />

      <AdminUserKycJourneySection kyc={kyc} />

      <AdminUserKycDetailTabs
        kyc={kyc}
        hasDownload={hasDownload}
        actionLoading={actionLoading}
        signatureDocumentId={signatureDocumentId}
        onPreview={(documentId) => void handlePreview(documentId)}
      />
    </div>
  );
}
