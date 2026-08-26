"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_ITEM_HEIGHT_PX = 44;
const DEFAULT_VISIBLE_ITEMS = 5;
const INLINE_ITEM_HEIGHT_PX = 36;
const INLINE_VISIBLE_ITEMS = 3;
const SCROLL_END_MS = 120;
const STEP_SCROLL_MS = 110;
const STEP_REPEAT_MS = 110;

let dialAudioContext: AudioContext | null = null;

function playDialTick() {
  if (typeof window === "undefined") return;

  try {
    dialAudioContext ??= new AudioContext();
    if (dialAudioContext.state === "suspended") {
      void dialAudioContext.resume();
    }

    const ctx = dialAudioContext;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(920, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  } catch {
    // Audio may be blocked until user gesture; ignore silently.
  }

  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(4);
  }
}

export type VerticalDialPickerProps = {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  onPreviewChange?: (value: number) => void;
  formatItem?: (value: number) => string;
  className?: string;
  ariaLabel?: string;
  variant?: "default" | "inline" | "dialog";
  disabled?: boolean;
};

function DialStepButton({
  direction,
  disabled,
  onStep,
  onStepEnd,
}: {
  direction: "up" | "down";
  disabled?: boolean;
  onStep: () => void;
  onStepEnd?: () => void;
}) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  const holdDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHoldTimers = useCallback(() => {
    if (holdDelayRef.current) {
      clearTimeout(holdDelayRef.current);
      holdDelayRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  const stopHold = useCallback(() => {
    clearHoldTimers();
    onStepEnd?.();
  }, [clearHoldTimers, onStepEnd]);

  const startHold = useCallback(() => {
    if (disabled) return;
    clearHoldTimers();
    onStep();
    holdDelayRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(onStep, STEP_REPEAT_MS);
    }, 320);
  }, [clearHoldTimers, disabled, onStep]);

  useEffect(() => stopHold, [stopHold]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        startHold();
      }}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      className="size-8 shrink-0 rounded-xl border-border/70 bg-background/80 shadow-none hover:bg-muted/40"
      aria-label={direction === "up" ? "Increase instalments" : "Decrease instalments"}
    >
      <Icon className="size-4" />
    </Button>
  );
}

export function VerticalDialPicker({
  min,
  max,
  value,
  onChange,
  onPreviewChange,
  formatItem,
  className,
  ariaLabel,
  variant = "default",
  disabled = false,
}: VerticalDialPickerProps) {
  const itemHeightPx =
    variant === "inline" ? INLINE_ITEM_HEIGHT_PX : DEFAULT_ITEM_HEIGHT_PX;
  const visibleItems =
    variant === "inline" ? INLINE_VISIBLE_ITEMS : DEFAULT_VISIBLE_ITEMS;
  const fadeFromClass =
    variant === "inline"
      ? "from-muted/15"
      : variant === "dialog"
        ? "from-muted/25"
        : "from-card";
  const isDialog = variant === "dialog";

  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const isPointerDraggingRef = useRef(false);
  const lastEmittedRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDragStartYRef = useRef(0);
  const pointerScrollStartRef = useRef(0);
  const keyHoldDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heldKeyRef = useRef<"ArrowUp" | "ArrowDown" | null>(null);
  const scrollAnimRafRef = useRef<number | null>(null);
  const isSteppingRef = useRef(false);

  const values = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, index) => min + index),
    [max, min],
  );
  const paddingCount = Math.floor(visibleItems / 2);
  const containerHeight = itemHeightPx * visibleItems;

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(value - min, 0), values.length - 1),
  );

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "auto") => {
      const element = scrollRef.current;
      if (!element) return;
      element.scrollTo({ top: index * itemHeightPx, behavior });
    },
    [itemHeightPx],
  );

  const scrollToValue = useCallback(
    (next: number, behavior: ScrollBehavior = "auto") => {
      scrollToIndex(next - min, behavior);
    },
    [min, scrollToIndex],
  );

  const scrollToIndexAnimated = useCallback(
    (index: number, duration = STEP_SCROLL_MS) => {
      const element = scrollRef.current;
      if (!element) return;

      const targetTop = index * itemHeightPx;
      const startTop = element.scrollTop;

      if (scrollAnimRafRef.current != null) {
        cancelAnimationFrame(scrollAnimRafRef.current);
        scrollAnimRafRef.current = null;
      }

      if (Math.abs(startTop - targetTop) < 0.5) {
        element.scrollTop = targetTop;
        return;
      }

      isSteppingRef.current = true;
      const startTime = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        element.scrollTop = startTop + (targetTop - startTop) * eased;

        if (progress < 1) {
          scrollAnimRafRef.current = requestAnimationFrame(tick);
          return;
        }

        scrollAnimRafRef.current = null;
        element.scrollTop = targetTop;
        isSteppingRef.current = false;
      };

      scrollAnimRafRef.current = requestAnimationFrame(tick);
    },
    [STEP_SCROLL_MS, itemHeightPx],
  );

  const commitValue = useCallback(
    (next: number, options?: { playTick?: boolean; previewOnly?: boolean }) => {
      const clamped = Math.min(Math.max(next, min), max);
      if (clamped === lastEmittedRef.current) return clamped;

      lastEmittedRef.current = clamped;
      setActiveIndex(clamped - min);
      if (options?.playTick) playDialTick();

      if (options?.previewOnly) {
        onPreviewChange?.(clamped);
      } else {
        onChange(clamped);
      }
      return clamped;
    },
    [max, min, onChange, onPreviewChange],
  );

  const stepValue = useCallback(
    (delta: number) => {
      if (disabled) return false;
      const previous = lastEmittedRef.current;
      isUserScrollingRef.current = true;
      const next = commitValue(previous + delta, {
        playTick: true,
        previewOnly: isDialog,
      });
      scrollToIndexAnimated(next - min);
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
        if (isDialog) {
          onChange(lastEmittedRef.current);
        }
      }, SCROLL_END_MS);
      return next !== previous;
    },
    [commitValue, disabled, isDialog, onChange, scrollToIndexAnimated],
  );

  const commitStepSelection = useCallback(() => {
    if (!isDialog) return;
    onChange(lastEmittedRef.current);
  }, [isDialog, onChange]);

  const stopKeyHold = useCallback(() => {
    const wasHolding = heldKeyRef.current !== null;
    heldKeyRef.current = null;
    if (keyHoldDelayRef.current) {
      clearTimeout(keyHoldDelayRef.current);
      keyHoldDelayRef.current = null;
    }
    if (keyHoldIntervalRef.current) {
      clearInterval(keyHoldIntervalRef.current);
      keyHoldIntervalRef.current = null;
    }
    if (wasHolding) {
      commitStepSelection();
    }
  }, [commitStepSelection]);

  const startKeyHold = useCallback(
    (key: "ArrowUp" | "ArrowDown") => {
      if (disabled) return;
      const delta = key === "ArrowUp" ? 1 : -1;
      if (heldKeyRef.current === key) return;

      stopKeyHold();
      heldKeyRef.current = key;
      stepValue(delta);

      keyHoldDelayRef.current = setTimeout(() => {
        keyHoldIntervalRef.current = setInterval(() => {
          const moved = stepValue(delta);
          if (!moved) stopKeyHold();
        }, STEP_REPEAT_MS);
      }, 320);
    },
    [disabled, stepValue, stopKeyHold],
  );

  const emitValueFromScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element || disabled || isSteppingRef.current) return;

    const index = Math.round(element.scrollTop / itemHeightPx);
    const clampedIndex = Math.min(Math.max(index, 0), values.length - 1);
    commitValue(values[clampedIndex], {
      playTick: !isDialog,
      previewOnly: isDialog,
    });
  }, [commitValue, disabled, isDialog, itemHeightPx, values]);

  const finalizeScroll = useCallback(() => {
    isUserScrollingRef.current = false;
    isPointerDraggingRef.current = false;

    const finalValue = lastEmittedRef.current;
    if (isDialog) {
      onChange(finalValue);
    }

    const element = scrollRef.current;
    if (!element) return;

    const expectedTop = (finalValue - min) * itemHeightPx;
    if (Math.abs(element.scrollTop - expectedTop) > 1) {
      scrollToValue(finalValue, "auto");
    }
  }, [isDialog, itemHeightPx, min, onChange, scrollToValue]);

  const handleScroll = useCallback(() => {
    if (disabled) return;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      emitValueFromScroll();
    });

    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
    }

    scrollEndTimerRef.current = setTimeout(finalizeScroll, SCROLL_END_MS);
  }, [disabled, emitValueFromScroll, finalizeScroll]);

  const markUserScroll = useCallback(() => {
    if (disabled) return;
    isUserScrollingRef.current = true;
  }, [disabled]);

  useEffect(() => {
    if (
      isUserScrollingRef.current ||
      isPointerDraggingRef.current ||
      heldKeyRef.current
    ) {
      return;
    }

    lastEmittedRef.current = value;
    setActiveIndex(Math.min(Math.max(value - min, 0), values.length - 1));
    scrollToValue(value);
  }, [min, scrollToValue, value, values.length]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (scrollAnimRafRef.current != null) cancelAnimationFrame(scrollAnimRafRef.current);
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      stopKeyHold();
    },
    [stopKeyHold],
  );

  useEffect(() => {
    if (!isDialog || disabled) return;
    const frame = requestAnimationFrame(() => {
      containerRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [disabled, isDialog]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (disabled) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    event.stopPropagation();
    startKeyHold(event.key);
  }

  function handleKeyUp(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    stopKeyHold();
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !isDialog || event.button !== 0) return;

    const element = scrollRef.current;
    if (!element) return;

    isPointerDraggingRef.current = true;
    isUserScrollingRef.current = true;
    pointerDragStartYRef.current = event.clientY;
    pointerScrollStartRef.current = element.scrollTop;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !isDialog || !isPointerDraggingRef.current) return;

    const element = scrollRef.current;
    if (!element) return;

    const deltaY = event.clientY - pointerDragStartYRef.current;
    element.scrollTop = pointerScrollStartRef.current - deltaY;
  }

  function handlePointerEnd() {
    if (!isPointerDraggingRef.current) return;
    isPointerDraggingRef.current = false;
    scrollToValue(lastEmittedRef.current, "smooth");
  }

  function renderDialItems() {
    return values.map((item, index) => {
      const distance = Math.abs(index - activeIndex);
      const isActive = index === activeIndex;

      return (
        <div
          key={item}
          role="option"
          aria-selected={isActive}
          style={{
            height: itemHeightPx,
            scrollSnapAlign: "center",
            ...(isActive ? {} : { opacity: Math.max(0.28, 1 - distance * 0.24) }),
          }}
          className={cn(
            "flex w-full min-w-0 items-center justify-center px-2 tabular-nums transition-[opacity,color] duration-150",
            isDialog
              ? isActive
                ? "relative z-10 text-base font-semibold text-foreground"
                : "text-compact font-medium text-muted-foreground"
              : cn(
                  "gap-2.5 pl-7 pr-2 transition-[transform]",
                  isActive
                    ? "scale-[1.03] font-semibold text-foreground"
                    : "text-compact font-medium text-muted-foreground",
                  variant === "inline"
                    ? isActive
                      ? "text-compact"
                      : "text-[11px]"
                    : isActive
                      ? "text-body"
                      : "text-compact",
                ),
          )}
        >
          {!isDialog ? (
            <span
              className={cn(
                "h-px shrink-0 bg-border/80 transition-all duration-150",
                isActive ? "w-4 bg-primary/55" : "w-2.5",
              )}
              aria-hidden
            />
          ) : null}
          <span>{formatItem?.(item) ?? String(item)}</span>
        </div>
      );
    });
  }

  const dialSurface = (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden",
        isDialog ? "flex-1" : "w-full",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-2 top-1/2 z-0 -translate-y-1/2",
          isDialog
            ? "rounded-2xl border border-border/60 bg-muted/30 shadow-sm"
            : "rounded-[var(--radius-control)] border border-primary/25 bg-primary/5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--primary)_12%,transparent)]",
        )}
        style={{ height: itemHeightPx }}
        aria-hidden
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b via-transparent to-transparent",
          fadeFromClass,
          variant === "inline" ? "h-10" : isDialog ? "h-12" : "h-[4.5rem]",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t via-transparent to-transparent",
          fadeFromClass,
          variant === "inline" ? "h-10" : isDialog ? "h-12" : "h-[4.5rem]",
        )}
      />

      {!isDialog ? (
        <div
          className="pointer-events-none absolute top-0 bottom-0 left-2 z-0 w-px bg-border/70"
          style={{
            maskImage: "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
          }}
          aria-hidden
        />
      ) : null}

      <div
        ref={scrollRef}
        tabIndex={disabled || isDialog ? -1 : 0}
        role="listbox"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-disabled={disabled}
        onScroll={handleScroll}
        onPointerDown={isDialog ? handlePointerDown : markUserScroll}
        onPointerMove={isDialog ? handlePointerMove : undefined}
        onPointerUp={isDialog ? handlePointerEnd : undefined}
        onPointerCancel={isDialog ? handlePointerEnd : undefined}
        onTouchStart={markUserScroll}
        onMouseDown={markUserScroll}
        onKeyDown={isDialog ? undefined : handleKeyDown}
        onKeyUp={isDialog ? undefined : handleKeyUp}
        className="relative z-10 scrollbar-none w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset"
        style={{
          height: containerHeight,
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {Array.from({ length: paddingCount }).map((_, index) => (
          <div key={`pad-top-${index}`} style={{ height: itemHeightPx }} aria-hidden />
        ))}

        {renderDialItems()}

        {Array.from({ length: paddingCount }).map((_, index) => (
          <div key={`pad-bottom-${index}`} style={{ height: itemHeightPx }} aria-hidden />
        ))}
      </div>
    </div>
  );

  if (isDialog) {
    return (
      <div
        ref={containerRef}
        tabIndex={disabled ? -1 : 0}
        onKeyDownCapture={handleKeyDown}
        onKeyUpCapture={handleKeyUp}
        onBlur={stopKeyHold}
        className={cn("flex min-w-0 items-stretch gap-1.5 outline-none", className)}
        aria-label={ariaLabel}
      >
        {dialSurface}
        <div className="flex shrink-0 flex-col justify-center gap-1.5 py-1">
          <DialStepButton
            direction="up"
            disabled={disabled || value >= max}
            onStep={() => stepValue(1)}
            onStepEnd={commitStepSelection}
          />
          <DialStepButton
            direction="down"
            disabled={disabled || value <= min}
            onStep={() => stepValue(-1)}
            onStepEnd={commitStepSelection}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative min-w-0 select-none", className)}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      {dialSurface}
    </div>
  );
}
