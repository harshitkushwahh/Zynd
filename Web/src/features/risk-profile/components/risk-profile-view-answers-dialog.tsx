"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { BrandDialog } from "@/components/ui/brand-dialog";
import { Badge } from "@/components/ui/badge";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  fetchRiskProfileAssessmentAnswers,
  type RiskProfileAssessmentAnswerItem,
} from "@/features/risk-profile/api/risk-profile-api";
import { RISK_PROFILE_HERO_RADIUS_CLASS } from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";

type RiskProfileViewAnswersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string | null;
};

export function RiskProfileViewAnswersDialog({
  open,
  onOpenChange,
  assessmentId,
}: RiskProfileViewAnswersDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<RiskProfileAssessmentAnswerItem[]>([]);

  useEffect(() => {
    if (!open || !assessmentId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setAnswers([]);

    void fetchRiskProfileAssessmentAnswers(assessmentId)
      .then((result) => {
        if (cancelled) return;
        setAnswers(result.answers ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : copy.riskProfile.viewAnswersLoadFailed);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, assessmentId]);

  if (!assessmentId) {
    return null;
  }

  const totalQuestions = answers.length;

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.riskProfile.viewAnswersTitle}
      maxWidth="lg"
    >
      <div className="max-h-[min(28rem,60vh)] overflow-y-auto px-6 py-5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        {loading ? (
          <p className="text-compact text-muted-foreground">{copy.riskProfile.viewAnswersLoading}</p>
        ) : null}

        {error ? <FieldMessage variant="error" message={error} /> : null}

        {!loading && !error && answers.length === 0 ? (
          <p className="text-compact text-muted-foreground">{copy.riskProfile.viewAnswersEmpty}</p>
        ) : null}

        {!loading && !error && answers.length > 0 ? (
          <ol className="space-y-3">
            {answers.map((item, index) => {
              const options =
                item.options && item.options.length > 0
                  ? item.options
                  : [
                      {
                        id: item.selected_option_id,
                        label: item.selected_option_label,
                        selected: true,
                      },
                    ];

              return (
              <li
                key={item.question_id}
                className={cn("border border-border bg-muted/20 p-4", RISK_PROFILE_HERO_RADIUS_CLASS)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {copy.riskProfile.viewAnswersQuestionLabel(index + 1, totalQuestions)}
                  </p>
                  {item.category_name ? (
                    <Badge variant="secondary" className="font-normal">
                      {item.category_name}
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-2 text-compact font-semibold leading-snug text-foreground">{item.prompt}</p>

                {item.help_text ? (
                  <p className="mt-1.5 text-caption leading-relaxed text-muted-foreground">{item.help_text}</p>
                ) : null}

                <ul className="mt-3 space-y-1.5">
                  {options.map((option) => (
                    <li
                      key={option.id}
                      className={cn(
                        "flex items-start gap-2.5 rounded-[var(--radius-control)] border px-3 py-2 text-compact leading-snug",
                        option.selected
                          ? "border-primary/25 bg-primary/5 text-foreground"
                          : "border-border/70 bg-muted/20 text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                          option.selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted/20 text-transparent",
                        )}
                        aria-hidden
                      >
                        {option.selected ? <Check className="size-2.5" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">{option.label}</span>
                    </li>
                  ))}
                </ul>
              </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </BrandDialog>
  );
}
