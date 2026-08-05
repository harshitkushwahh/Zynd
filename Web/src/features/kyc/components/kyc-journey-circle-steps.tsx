"use client";

import { Check } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { KYC_JOURNEY_STEPS, type KycJourneyStep } from "@/features/kyc/lib/kyc-journey";
import { getKycStepFormMeta } from "@/features/kyc/lib/kyc-step-form-meta";
import { cn } from "@/lib/utils";

const STEP_SLOT_WIDTH = "5.75rem";
const CONNECTOR_WIDTH = "2.75rem";
const SCROLL_EDGE_PADDING = 24;

type KycJourneyCircleStepsProps = {
  activeStepIndex: number;
  maxReachableStepIndex: number;
  steps?: KycJourneyStep[];
  onStepSelect: (index: number) => void;
  className?: string;
};

function JourneyStepConnector({ complete }: { complete: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-[1.125rem] h-0 shrink-0 border-t-2",
        complete ? "border-success border-solid" : "border-dashed border-muted-foreground/35",
      )}
      style={{ width: CONNECTOR_WIDTH }}
    />
  );
}

function JourneyScrollFade({
  side,
  visible,
}: {
  side: "left" | "right";
  visible: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-0 z-10 h-9 w-10 transition-opacity duration-300 sm:w-12",
        side === "left" ? "left-0" : "right-0",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "absolute inset-0",
          side === "left"
            ? "bg-gradient-to-r from-card via-card/85 to-transparent"
            : "bg-gradient-to-l from-card via-card/85 to-transparent",
        )}
      />
    </div>
  );
}

export function KycJourneyCircleSteps({
  activeStepIndex,
  maxReachableStepIndex,
  steps = KYC_JOURNEY_STEPS,
  onStepSelect,
  className,
}: KycJourneyCircleStepsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const prefersInstantScrollRef = useRef(true);

  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFadeState = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const maxScroll = container.scrollWidth - container.clientWidth;
    setShowLeftFade(container.scrollLeft > 6);
    setShowRightFade(maxScroll > 6 && container.scrollLeft < maxScroll - 6);
  }, []);

  const scrollToStep = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current;
    const stepEl = stepRefs.current[index];
    if (!container || !stepEl) return;

    const containerLeft = container.getBoundingClientRect().left;
    const stepLeft = stepEl.getBoundingClientRect().left;
    const targetScroll = container.scrollLeft + (stepLeft - containerLeft) - SCROLL_EDGE_PADDING;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);

    container.scrollTo({
      left: Math.max(0, Math.min(targetScroll, maxScroll)),
      behavior,
    });
  }, []);

  useLayoutEffect(() => {
    scrollToStep(activeStepIndex, prefersInstantScrollRef.current ? "auto" : "smooth");
    prefersInstantScrollRef.current = false;
    updateFadeState();
  }, [activeStepIndex, scrollToStep, updateFadeState, steps.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => updateFadeState();
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [updateFadeState, steps.length]);

  return (
    <nav
      aria-label="KYC steps"
      className={cn("relative w-full border-b border-border/40 pb-4", className)}
    >
      <JourneyScrollFade side="left" visible={showLeftFade} />
      <JourneyScrollFade side="right" visible={showRightFade} />

      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto scroll-smooth",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <ol className="flex w-max items-start pl-6 pr-6">
          {steps.map((step, index) => {
            const isFirst = index === 0;
            const isActive = index === activeStepIndex;
            const isComplete = index < activeStepIndex;
            const isReachable = index <= maxReachableStepIndex;
            const canNavigate = isReachable && !isActive;
            const connectorComplete = index > 0 && index - 1 < activeStepIndex;
            const StepIcon = getKycStepFormMeta(step.id).icon;

            return (
              <li key={step.id} className="flex shrink-0 items-start">
                {!isFirst ? <JourneyStepConnector complete={connectorComplete} /> : null}

                <div
                  ref={(node) => {
                    stepRefs.current[index] = node;
                  }}
                  className="flex shrink-0 flex-col items-center"
                  style={{ width: STEP_SLOT_WIDTH }}
                >
                  <button
                    type="button"
                    aria-current={isActive ? "step" : undefined}
                    aria-label={step.label}
                    disabled={!canNavigate}
                    onClick={() => {
                      if (canNavigate) onStepSelect(index);
                    }}
                    className={cn(
                      "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isComplete &&
                        "bg-success text-success-foreground shadow-sm hover:bg-success/90 disabled:hover:bg-success",
                      isActive && "bg-primary text-primary-foreground shadow-sm",
                      !isComplete &&
                        !isActive &&
                        isReachable &&
                        "border-2 border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      !isReachable &&
                        "cursor-not-allowed border-2 border-dashed border-muted-foreground/30 bg-muted/20 text-muted-foreground/45",
                    )}
                  >
                    {isComplete ? (
                      <Check className="size-4" strokeWidth={2.5} />
                    ) : (
                      <StepIcon className="size-4" strokeWidth={2} aria-hidden />
                    )}
                  </button>

                  <span
                    className={cn(
                      "mt-2 w-full px-0.5 text-center text-[10px] font-medium leading-tight sm:text-[11px]",
                      isActive && "font-semibold text-foreground",
                      isComplete && !isActive && "text-success",
                      !isComplete && !isActive && isReachable && "text-muted-foreground",
                      !isReachable && "text-muted-foreground/45",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
