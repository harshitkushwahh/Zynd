"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ZtoLookupReviewDialog } from "@/features/kyc/components/zto-lookup-review-dialog";
import { fetchZtoFlowStatus, fetchZtoReviewData } from "@/features/kyc/lib/zto-api";
import type { ZtoPhase, ZtoReviewFields } from "@/features/kyc/lib/zto-types";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 15;
const POLLING_PHASES: ReadonlySet<ZtoPhase> = new Set(["LOOKUP_PENDING", "LOOKUPS_RUNNING"]);
/** No dashboard ZTO UI after signup unless lookups were started during signup. */
const INACTIVE_PHASES: ReadonlySet<ZtoPhase> = new Set([
  "NOT_STARTED",
  "DISABLED",
  "ACCEPTED",
  "DECLINED",
  "LOOKUPS_FAILED",
]);
const ZTO_FLOW_STARTED_EVENT = "zto-flow-started";

export function notifyZtoFlowStarted() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ZTO_FLOW_STARTED_EVENT));
  }
}

type ZtoReviewGateProps = {
  enabled?: boolean;
  onResolved?: (decision: "accepted" | "declined") => void;
};

/**
 * Dashboard onboarding gate: polls ZTO flow status after signup and opens the
 * non-dismissible review dialog once lookups finish (REVIEW_PENDING).
 */
export function ZtoReviewGate({ enabled = true, onResolved }: ZtoReviewGateProps) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<ZtoReviewFields | null>(null);
  const cancelledRef = useRef(false);

  const openReview = useCallback(async () => {
    const data = await fetchZtoReviewData();
    if (cancelledRef.current || data.phase !== "REVIEW_PENDING") return;
    setFields(data.fields);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (attempt: number) => {
      try {
        const status = await fetchZtoFlowStatus();
        if (cancelledRef.current || !status.enabled) return;
        if (INACTIVE_PHASES.has(status.phase)) return;
        if (status.review_required || status.phase === "REVIEW_PENDING") {
          await openReview();
          return;
        }
        if (POLLING_PHASES.has(status.phase) && attempt < MAX_POLL_ATTEMPTS) {
          timer = setTimeout(() => void poll(attempt + 1), POLL_INTERVAL_MS);
        }
      } catch {
        // Best-effort: ZTO must never block the dashboard.
      }
    };

    const restart = () => {
      if (timer) clearTimeout(timer);
      void poll(0);
    };

    void poll(0);
    window.addEventListener(ZTO_FLOW_STARTED_EVENT, restart);
    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(ZTO_FLOW_STARTED_EVENT, restart);
    };
  }, [enabled, openReview]);

  if (!open) return null;

  return (
    <ZtoLookupReviewDialog
      open
      initialFields={fields}
      onResolved={(decision) => {
        setOpen(false);
        onResolved?.(decision);
      }}
    />
  );
}
