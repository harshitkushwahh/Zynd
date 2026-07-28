"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { fetchDistributorClientRiskAssessmentDetail } from "@/lib/distributor-client-risk-api";
import { buildDemoRiskAssessmentAnswers } from "@/lib/client-risk-assessments";
import type { DistributorClientRiskAssessmentAnswer } from "@/lib/dummy/types";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api-client";
import {
  DISTRIBUTOR_OVERLAY_BODY_SCROLL_CLASS,
  DISTRIBUTOR_OVERLAY_HEADER_CLASS,
} from "@/lib/distributor-layout";

type ClientRiskProfileViewAnswersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientReference: string;
  assessmentId: string | null;
};

export function ClientRiskProfileViewAnswersDialog({
  open,
  onOpenChange,
  clientReference,
  assessmentId,
}: ClientRiskProfileViewAnswersDialogProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.riskProfile;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<DistributorClientRiskAssessmentAnswer[]>([]);

  useEffect(() => {
    if (!open || !assessmentId) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setAnswers([]);

    if (!env.useBackendClients) {
      setAnswers(buildDemoRiskAssessmentAnswers(assessmentId));
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void fetchDistributorClientRiskAssessmentDetail(clientReference, assessmentId)
      .then((result) => {
        if (!cancelled) setAnswers(result.answers);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : copy.viewAnswersLoadFailed);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, assessmentId, clientReference, copy.viewAnswersLoadFailed]);

  if (!assessmentId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{copy.viewAnswersTitle}</DialogTitle>
        <DialogDescription>{copy.viewAnswersDescription}</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-lg gap-0 p-0">
        <div className={DISTRIBUTOR_OVERLAY_HEADER_CLASS}>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" aria-hidden />
            <h2 className="text-compact font-semibold">{copy.viewAnswersTitle}</h2>
          </div>
          <p className="distributor-panel-card__description">{copy.viewAnswersDescription}</p>
        </div>
        <div className={DISTRIBUTOR_OVERLAY_BODY_SCROLL_CLASS}>
          {loading ? (
            <p className="text-caption text-muted-foreground">{copy.viewAnswersLoading}</p>
          ) : null}
          {error ? <p className="text-caption text-destructive">{error}</p> : null}
          {!loading && !error && answers.length === 0 ? (
            <p className="text-caption text-muted-foreground">{copy.viewAnswersEmpty}</p>
          ) : null}
          <ul className="divide-y divide-border">
            {answers.map((answer) => (
              <li key={answer.questionId} className="py-3 text-compact">
                <p className="text-caption text-muted-foreground">
                  {answer.sortOrder}. {answer.categoryName ?? "Question"}
                </p>
                <p className="mt-1 font-medium text-foreground">{answer.prompt}</p>
                <p className="mt-1.5 text-caption">
                  <span className="text-muted-foreground">Answer: </span>
                  {answer.selectedOptionLabel}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
