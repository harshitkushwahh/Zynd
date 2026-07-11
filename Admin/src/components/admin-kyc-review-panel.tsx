"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchAdminDocumentDownload,
  fetchAdminKycReview,
  rejectAdminKycDocument,
  verifyAdminDocument,
  verifyAdminUserKycDocuments,
  type AdminKycReview,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

type AdminKycReviewPanelProps = {
  hasDownload: boolean;
  hasVerify: boolean;
};

export function AdminKycReviewPanel({ hasDownload, hasVerify }: AdminKycReviewPanelProps) {
  const [userId, setUserId] = useState("");
  const [review, setReview] = useState<AdminKycReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadReview = async () => {
    if (!userId.trim()) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = await fetchAdminKycReview(userId.trim());
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
    <Card>
      <CardHeader>
        <CardTitle>KYC document review</CardTitle>
        <CardDescription>
          Review user KYC uploads by client ID, preview files, and approve or reject.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="User UUID"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          />
          <Button variant="outline" disabled={loading || !userId.trim()} onClick={() => void loadReview()}>
            {loading ? "Loading..." : "Load KYC"}
          </Button>
        </div>

        {error ? <p className="text-compact text-destructive">{error}</p> : null}
        {message ? <p className="text-compact text-muted-foreground">{message}</p> : null}

        {review ? (
          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <p className="font-medium text-foreground">{review.email}</p>
              <p className="text-caption text-muted-foreground">
                Client ID: {review.client_id}
              </p>
            </div>

            {hasVerify ? (
              <Button
                size="sm"
                disabled={actionLoading === "verify-all"}
                onClick={() => void handleVerifyAll()}
              >
                Verify all KYC documents
              </Button>
            ) : null}

            <div className="space-y-3">
              {review.documents.length === 0 ? (
                <p className="text-compact text-muted-foreground">No KYC documents uploaded.</p>
              ) : (
                review.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {document.doc_type} · v{document.version}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {document.kyc_review_status ?? "n/a"} · {document.status} ·{" "}
                        {document.original_filename}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                            disabled={actionLoading === `verify-${document.id}`}
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
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
