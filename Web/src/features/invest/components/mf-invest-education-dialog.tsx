"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Target,
  Users,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  INVEST_EDUCATION_ILLUSTRATION_FALLBACKS,
  INVEST_EDUCATION_ILLUSTRATIONS,
  INVEST_EDUCATION_STEP_IDS,
  investEducationUsesLogoSupport,
  type InvestEducationStepId,
} from "@/features/invest/lib/invest-education-steps";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD_PX = 48;

const STEP_ICONS: Record<InvestEducationStepId, LucideIcon> = {
  cybrilla: Building2,
  folio_nomination: Users,
  sip: CalendarClock,
  lumpsum: CreditCard,
  family_goals: Target,
};

type MfInvestEducationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function StepIllustration({ stepId }: { stepId: InvestEducationStepId }) {
  const [src, setSrc] = useState(
    INVEST_EDUCATION_ILLUSTRATIONS[stepId] ?? INVEST_EDUCATION_ILLUSTRATION_FALLBACKS[stepId],
  );
  const [failed, setFailed] = useState(false);
  const Icon = STEP_ICONS[stepId];

  useEffect(() => {
    setSrc(INVEST_EDUCATION_ILLUSTRATIONS[stepId] ?? INVEST_EDUCATION_ILLUSTRATION_FALLBACKS[stepId]);
    setFailed(false);
  }, [stepId]);

  const handleError = () => {
    const fallback = INVEST_EDUCATION_ILLUSTRATION_FALLBACKS[stepId];
    if (src !== fallback) {
      setSrc(fallback);
      return;
    }
    setFailed(true);
  };

  const logoSupport = investEducationUsesLogoSupport(stepId, src);

  return (
    <div className="relative flex min-h-[11rem] w-full items-center justify-center py-1">
      {!failed ? (
        logoSupport ? (
          <div className="flex items-center justify-center rounded-[var(--radius-card)] bg-white px-10 py-7 shadow-md ring-1 ring-black/[0.06]">
            <Image
              key={src}
              src={src}
              alt=""
              width={360}
              height={120}
              className="h-[4.25rem] w-auto max-w-[min(100%,16rem)] object-contain sm:h-[4.75rem]"
              onError={handleError}
            />
          </div>
        ) : (
          <Image
            key={src}
            src={src}
            alt=""
            width={400}
            height={240}
            className="max-h-[11rem] w-auto max-w-full object-contain drop-shadow-md"
            onError={handleError}
          />
        )
      ) : (
        <span className="flex size-20 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
          <Icon className="size-9 text-primary-foreground" strokeWidth={1.75} aria-hidden />
        </span>
      )}
    </div>
  );
}

function StepPagination({
  steps,
  activeIndex,
  onSelect,
}: {
  steps: { id: string; title: string }[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5" role="tablist">
      {steps.map((step, index) => (
        <button
          key={step.id}
          type="button"
          role="tab"
          aria-selected={index === activeIndex}
          aria-label={step.title}
          onClick={() => onSelect(index)}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            index === activeIndex ? "w-7 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/35",
          )}
        />
      ))}
    </div>
  );
}

export function MfInvestEducationDialog({ open, onOpenChange }: MfInvestEducationDialogProps) {
  const guide = copy.mutualFunds.investEducationGuide;
  const steps = guide.steps;
  const count = steps.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (nextIndex: number) => {
      if (count <= 0) return;
      setActiveIndex(((nextIndex % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!open) {
      setActiveIndex(0);
      pointerStartX.current = null;
    }
  }, [open]);

  const finishDrag = useCallback(
    (deltaX: number) => {
      if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
        goTo(activeIndex + (deltaX < 0 ? 1 : -1));
      }
      pointerStartX.current = null;
    },
    [activeIndex, goTo],
  );

  const activeStep = steps[activeIndex];
  const stepId = (activeStep?.id ?? INVEST_EDUCATION_STEP_IDS[0]) as InvestEducationStepId;
  const isLast = activeIndex >= count - 1;
  const isFirst = activeIndex === 0;

  const goNext = () => {
    if (isLast) onOpenChange(false);
    else goTo(activeIndex + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(100vw-1.5rem,32rem)] gap-0 overflow-hidden rounded-[var(--radius-3xl)] border border-border/40 p-0 shadow-zynd-high sm:max-w-[min(100vw-2rem,34rem)]"
      >
        <DialogTitle className="sr-only">{activeStep?.title ?? guide.dialogTitle}</DialogTitle>

        <div
          className="touch-pan-y"
          onPointerDown={(event) => {
            if (count <= 1) return;
            pointerStartX.current = event.clientX;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            if (pointerStartX.current === null) return;
            finishDrag(event.clientX - pointerStartX.current);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (pointerStartX.current === null) return;
            finishDrag(event.clientX - pointerStartX.current);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
        >
          <div className="relative bg-gradient-brand px-5 pb-6 pt-5 text-primary-foreground sm:px-6">
            <div
              className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/15 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-8 -left-8 size-32 rounded-full bg-black/10 blur-2xl"
              aria-hidden
            />

            <div className="relative flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/80">
                {guide.dialogTitle}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full text-primary-foreground/90 hover:bg-white/15 hover:text-primary-foreground"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <XIcon className="size-4" strokeWidth={2} />
              </Button>
            </div>

            <div key={stepId} className="relative mt-4 animate-in fade-in duration-300 motion-reduce:animate-none">
              <StepIllustration stepId={stepId} />
            </div>
          </div>

          <div
            key={`${stepId}-copy`}
            className="animate-in fade-in slide-in-from-bottom-1 bg-card px-5 py-5 duration-300 motion-reduce:animate-none sm:px-6"
          >
            <h2 className="text-body font-semibold leading-snug tracking-tight text-foreground">
              {activeStep?.title}
            </h2>
            <p className="mt-2.5 text-compact leading-relaxed text-muted-foreground">{activeStep?.body}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 bg-muted/10 px-4 py-3.5 sm:px-5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 shrink-0 rounded-full border-border/80 bg-card shadow-none"
            disabled={isFirst}
            aria-label={guide.back}
            onClick={() => goTo(activeIndex - 1)}
          >
            <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
          </Button>

          <StepPagination steps={steps} activeIndex={activeIndex} onSelect={goTo} />

          <Button
            type="button"
            size="icon"
            className="size-10 shrink-0 rounded-full shadow-zynd-low"
            aria-label={isLast ? guide.done : guide.next}
            onClick={goNext}
          >
            <ChevronRight className="size-5" strokeWidth={2.25} aria-hidden />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
