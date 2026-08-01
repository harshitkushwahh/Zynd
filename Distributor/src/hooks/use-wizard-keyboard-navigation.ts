"use client";

import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isTextareaTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement;
}

function isButtonTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLButtonElement;
}

type UseWizardKeyboardNavigationOptions = {
  enabled?: boolean;
  onContinue: () => void;
  onBack: () => void;
  canContinue?: boolean;
  canBack?: boolean;
};

/** Enter continues; Backspace (Mac Delete) goes back when not editing text. */
export function useWizardKeyboardNavigation({
  enabled = true,
  onContinue,
  onBack,
  canContinue = true,
  canBack = true,
}: UseWizardKeyboardNavigationOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;

      if (event.key === "Enter" && !event.shiftKey) {
        if (isTextareaTarget(target)) return;
        if (isButtonTarget(target)) return;
        if (!canContinue) return;
        event.preventDefault();
        onContinue();
        return;
      }

      if (event.key === "Backspace") {
        if (isEditableTarget(target)) return;
        if (!canBack) return;
        event.preventDefault();
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onContinue, onBack, canContinue, canBack]);
}
