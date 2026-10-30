import { copy } from "@/shared/config/copy";

export type AiNavbarNudgeContext = {
  id: string;
  headline: string;
};

const nudgeCopy = copy.navbar.aiNudge;

function context(id: keyof typeof nudgeCopy.contexts): AiNavbarNudgeContext {
  return {
    id,
    headline: nudgeCopy.contexts[id].headline,
  };
}

/** Dummy page-aware nudge payload for navbar AI hover card (no API). */
export function resolveAiNavbarNudge(pathname: string): AiNavbarNudgeContext {
  if (pathname.startsWith("/dashboard/risk-profile")) {
    return context("riskProfile");
  }
  if (pathname.startsWith("/dashboard/invest")) {
    return context("invest");
  }
  if (pathname.startsWith("/dashboard/portfolio")) {
    return context("portfolio");
  }
  if (pathname.startsWith("/dashboard/recommend-funds") || pathname.includes("funds-for-you")) {
    return context("recommendFunds");
  }
  if (pathname.startsWith("/dashboard/zyndai") || pathname.startsWith("/dashboard/ai-chat")) {
    return context("aiChat");
  }
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/overview")) {
    return context("overview");
  }
  return context("default");
}

export const AI_ASSISTANT_DRAFT_PREFILL_KEY = "zynd-ai-assistant-draft-prefill";
