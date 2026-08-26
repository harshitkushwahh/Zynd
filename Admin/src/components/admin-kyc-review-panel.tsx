"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getErrorMessage } from "@/lib/errors";
import {
  ExternalLink,
  FileSearch,
  FileText,
  ShieldCheck,
} from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminProfilePageSkeleton, AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { documentReviewStatusVariant } from "@/components/users/user-status-badge";
import { userInitials } from "@/lib/admin-capabilities";
import { clientIdToProfilePath } from "@/lib/admin-user-ref";
import {
  fetchAdminDocumentDownload,
  fetchAdminKycReview,
  rejectAdminKycDocument,
  verifyAdminDocument,
  verifyAdminUserKycDocuments,
  type AdminKycDocument,
  type AdminKycReview,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN card",
  profile_image: "Profile photo",
  bank_statement: "Bank statement",
  signature: "Signature",
  address_proof: "Address proof",
  nominee_id: "Nominee ID",
};


function formatDocumentType(docType: string) {
  return DOCUMENT_TYPE_LABELS[docType] ?? docType.replaceAll("_", " ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isDocumentVerified(document: AdminKycDocument) {
  const status = (document.kyc_review_status ?? document.status ?? "").toLowerCase();
  return status === "verified" || status === "approved";
}

function userProfileHref(clientId: string) {
  return `/dashboard/users/${encodeURIComponent(clientIdToProfilePath(clientId))}`;
}

type AdminKycReviewPanelProps = {
  hasDownload: boolean;
  hasVerify: boolean;
};

function KycLookupEmptyState() {
  return (
    <div className="flex flex-col items-center px-6 py-empty-state-xl text-center">
      <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
        <FileSearch className="size-6" strokeWidth={2} />
      </div>
      <p className="mt-4 font-medium text-foreground">Look up a customer</p>
      <p className="mt-1 max-w-md text-caption leading-relaxed text-muted-foreground">
        Enter a client ID or user reference to load uploaded KYC documents for preview,
        verification, or rejection.
      </p>
    </div>
  );
}

function KycDocumentsEmptyState() {
  return (
    <div className="flex flex-col items-center px-6 py-empty-state-lg text-center">
      <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
        <FileText className="size-6" strokeWidth={2} />
      </div>
      <p className="mt-4 font-medium text-foreground">No documents uploaded</p>
      <p className="mt-1 max-w-sm text-caption leading-relaxed text-muted-foreground">
        Uploaded identity, address, and bank proofs will appear here once the customer
        submits them.
      </p>
    </div>
  );
}

export function AdminKycReviewPanel({ hasDownload, hasVerify }: AdminKycReviewPanelProps) {
  const [userRef, setUserRef] = useState("");
  const [review, setReview] = useState<AdminKycReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const documentStats = useMemo(() => {
    if (!review) return null;
    const verified = review.documents.filter(isDocumentVerified).length;
    const pending = review.documents.length - verified;
    return {
      total: review.documents.length,
      pending,
      verified,
    };
  }, [review]);

  const loadReview = async () => {
    const query = userRef.trim();
    if (!query) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = await fetchAdminKycReview(query);
      setReview(payload);
      setMessage("KYC review loaded.");
    } catch (err) {
      setReview(null);
      setError(getErrorMessage(err, "Could not load KYC review."));
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (documentId: string) => {
    if (!hasDownload) return;
    setActionLoading(`preview-${documentId}`);
    try {
      const payload = await fetchAdminDocumentDownload(documentId);
      window.open(payload.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(getErrorMessage(err, "Could not open document preview."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerify = async (documentId: string) => {
    if (!hasVerify) return;
    setActionLoading(`verify-${documentId}`);
    setError("");
    try {
      await verifyAdminDocument(documentId);
      setMessage("Document verified.");
      await loadReview();
    } catch (err) {
      setError(getErrorMessage(err, "Could not verify document."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (documentId: string) => {
    if (!hasVerify) return;
    setActionLoading(`reject-${documentId}`);
    setError("");
    try {
      await rejectAdminKycDocument(documentId, "Rejected during KYC review");
      setMessage("Document rejected.");
      await loadReview();
    } catch (err) {
      setError(getErrorMessage(err, "Could not reject document."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyAll = async () => {
    if (!hasVerify || !review) return;
    setActionLoading("verify-all");
    setError("");
    try {
      const result = await verifyAdminUserKycDocuments(review.user_id);
      setMessage(`Verified ${result.verified_count} documents.`);
      await loadReview();
    } catch (err) {
      setError(getErrorMessage(err, "Could not verify KYC documents."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Client ID or user reference"
          value={userRef}
          onChange={(event) => setUserRef(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && userRef.trim()) {
              void loadReview();
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            disabled={loading || !userRef.trim()}
            onClick={() => void loadReview()}
          >
            {loading ? "Loading..." : "Load review"}
          </Button>
          {review ? (
            <Button
              variant="outline"
              onClick={() => {
                setReview(null);
                setUserRef("");
                setMessage("");
                setError("");
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <AdminProfilePageSkeleton />
      ) : review ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-11 border border-border">
                <AvatarFallback>
                  {userInitials(review.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{review.email}</p>
                <p className="mt-0.5 truncate text-caption text-muted-foreground">
                  Client ID: {review.client_id}
                </p>
                <Link
                  href={userProfileHref(review.client_id)}
                  className="mt-1 inline-flex items-center gap-1 text-caption text-primary hover:underline"
                >
                  Open full profile
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>

            {hasVerify && review.documents.length > 0 ? (
              <Button
                size="sm"
                disabled={actionLoading === "verify-all"}
                onClick={() => void handleVerifyAll()}
              >
                <ShieldCheck className="size-3.5" />
                {actionLoading === "verify-all" ? "Verifying..." : "Verify all documents"}
              </Button>
            ) : null}
          </div>

          {documentStats ? (
            <AdminMetricCardsGrid columns="three">
              <AdminMetricCard
                label="Uploaded documents"
                value={documentStats.total}
                icon={FileText}
                tone="info"
              />
              <AdminMetricCard
                label="Pending review"
                value={documentStats.pending}
                icon={FileSearch}
                tone={documentStats.pending > 0 ? "warning" : "default"}
              />
              <AdminMetricCard
                label="Verified"
                value={documentStats.verified}
                icon={ShieldCheck}
                tone="success"
              />
            </AdminMetricCardsGrid>
          ) : null}

          <AdminDataTable minWidth="3xl">
            <AdminTableHeader>
              <tr>
                {hasDownload || hasVerify ? (
                  <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
                ) : null}
                <AdminTableHeadCell>Document</AdminTableHeadCell>
                <AdminTableHeadCell>File</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
                <AdminTableHeadCell>Uploaded</AdminTableHeadCell>
              </tr>
            </AdminTableHeader>
            <AdminTableBody>
              {loading ? (
                <AdminTableSkeletonRows columns={hasDownload || hasVerify ? 5 : 4} />
              ) : review.documents.length === 0 ? (
                <AdminTableStateRow colSpan={hasDownload || hasVerify ? 5 : 4}>
                  <KycDocumentsEmptyState />
                </AdminTableStateRow>
              ) : (
                review.documents.map((document) => (
                  <AdminTableRow key={document.id}>
                    {hasDownload || hasVerify ? (
                      <AdminTableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {hasDownload ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoading === `preview-${document.id}`}
                              onClick={() => void handlePreview(document.id)}
                            >
                              Preview
                            </Button>
                          ) : null}
                          {hasVerify ? (
                            <>
                              <Button
                                size="sm"
                                disabled={
                                  actionLoading === `verify-${document.id}` ||
                                  isDocumentVerified(document)
                                }
                                onClick={() => void handleVerify(document.id)}
                              >
                                Verify
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionLoading === `reject-${document.id}`}
                                onClick={() => void handleReject(document.id)}
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </AdminTableCell>
                    ) : null}
                    <AdminTableCell>
                      <p className="font-medium text-foreground">
                        {formatDocumentType(document.doc_type)}
                      </p>
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        v{document.version}
                      </p>
                    </AdminTableCell>
                    <AdminTableCell>
                      <p className="truncate font-medium text-foreground">
                        {document.original_filename}
                      </p>
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        {document.mime_type}
                      </p>
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge
                        variant={documentReviewStatusVariant(
                          document.kyc_review_status ?? document.status ?? "",
                        )}
                      >
                        {document.kyc_review_status ?? document.status}
                      </StatusBadge>
                    </AdminTableCell>
                    <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(document.created_at)}
                    </AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminDataTable>
        </div>
      ) : (
        <KycLookupEmptyState />
      )}
    </div>
  );
}
