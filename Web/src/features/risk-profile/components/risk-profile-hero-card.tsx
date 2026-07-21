"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Lock, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import { RiskAssessmentCircleProgress } from "@/features/risk-profile/components/risk-assessment-circle-progress";
import { RISK_PROFILE_ASSESSMENT_HREF } from "@/features/risk-profile/lib/risk-profile-navigation";
import {
  RISK_PROFILE_HERO_GRADIENT_CLASS,
  RISK_PROFILE_HERO_RADIUS_CLASS,
  RISK_PROFILE_TOP_ROW_MIN_HEIGHT_CLASS,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export function RiskProfileHeroCard({ className }: { className?: string }) {
  const riskProfile = useRiskProfileOptional();
  const assessmentInProgress = riskProfile?.assessmentInProgress ?? false;
  const assessmentDraftProgress = riskProfile?.assessmentDraftProgress ?? null;
  const isLocked = riskProfile?.isLocked ?? false;
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const actionLabel = assessmentInProgress
    ? copy.riskProfile.continueAction
    : copy.riskProfile.startAction;

  const handleDiscardDraft = async () => {
    if (!riskProfile?.clearAssessmentDraft) return;
    setDiscarding(true);
    try {
      await riskProfile.clearAssessmentDraft();
      setDiscardDialogOpen(false);
      toast.success("Draft discarded.");
    } catch {
      toast.error(copy.riskProfile.errors.loadFailed);
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <>
      <section
        className={cn(
          "relative h-full overflow-hidden border border-primary-foreground/10 p-4 shadow-zynd-mid sm:p-5",
          RISK_PROFILE_TOP_ROW_MIN_HEIGHT_CLASS,
          RISK_PROFILE_HERO_RADIUS_CLASS,
          RISK_PROFILE_HERO_GRADIENT_CLASS,
          className,
        )}
      >
        <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-20" />
        <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 size-36 rounded-full bg-[color-mix(in_srgb,var(--zynd-emerald)_28%,transparent)] blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--zynd-navy)_35%,transparent)_100%)]" />

        <div className="relative z-10 flex h-full flex-col justify-center sm:pr-[8.5rem] md:pr-[9.5rem] lg:pr-[10.5rem]">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex flex-col gap-3">
              <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-1 text-caption font-medium text-primary-foreground/90 backdrop-blur-sm">
                <Sparkles className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                {copy.riskProfile.heroEyebrow}
              </p>
              <h2 className="max-w-md text-h4 font-semibold tracking-tight text-primary-foreground sm:text-h3">
                {isLocked ? (
                  copy.riskProfile.lockedAttemptsTitle
                ) : (
                  <>
                    {copy.riskProfile.heroTitle}
                    <span className="block">{copy.riskProfile.heroTitleSubline}</span>
                  </>
                )}
              </h2>
              <p className="max-w-[19rem] text-caption leading-snug text-primary-foreground/80 sm:max-w-[21rem] sm:text-compact sm:leading-relaxed">
                {isLocked
                  ? copy.riskProfile.lockedAttemptsDescription
                  : copy.riskProfile.heroDescription}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {isLocked ? (
                <Button
                  size="sm"
                  disabled
                  className="gap-2 bg-primary-foreground/20 text-primary-foreground"
                >
                  <Lock className="size-4" />
                  {copy.riskProfile.lockedAttemptsTitle}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={RISK_PROFILE_ASSESSMENT_HREF} />}
                    className="gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                  >
                    {actionLabel}
                    <ArrowRight className="size-4" />
                  </Button>
                  {assessmentInProgress && assessmentDraftProgress ? (
                    <RiskAssessmentCircleProgress
                      current={assessmentDraftProgress.current}
                      total={assessmentDraftProgress.total}
                      variant="hero"
                    />
                  ) : null}
                  {assessmentInProgress ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      aria-label={copy.riskProfile.discardDraftAction}
                      disabled={discarding}
                      onClick={() => setDiscardDialogOpen(true)}
                    >
                      <Trash2 className="size-4" strokeWidth={2.25} />
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 right-0 z-10 h-[95%] w-[9rem] sm:w-[10rem] md:w-[11rem] lg:w-[12rem]">
          <Image
            src="/heror.png"
            alt=""
            fill
            sizes="(min-width: 1024px) 192px, 144px"
            className="object-contain object-bottom object-right mix-blend-screen drop-shadow-lg"
            priority
          />
        </div>
      </section>

      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        variant="destructive"
        title={copy.riskProfile.discardDraftConfirm.title}
        description={copy.riskProfile.discardDraftConfirm.description}
        confirmLabel={copy.riskProfile.discardDraftConfirm.confirm}
        cancelLabel={copy.riskProfile.discardDraftConfirm.cancel}
        loading={discarding}
        onConfirm={() => void handleDiscardDraft()}
      />
    </>
  );
}
