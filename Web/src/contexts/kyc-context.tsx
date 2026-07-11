"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/contexts/auth-context";
import {
  ensureKycToken,
  checkKycReadiness,
  fetchKycBootstrap,
  fetchKycFormStatus,
  type KycBootstrapResponse,
  type KycReadinessCheckResponse,
} from "@/features/kyc/lib/kyc-api";
import type { KycRecord, KycStatus } from "@/features/kyc/lib/kyc-types";

type KycContextValue = {
  status: KycStatus | null;
  record: KycRecord | null;
  overallStatus: string | null;
  showRing: boolean;
  showKycMenu: boolean;
  kycAllowed: boolean;
  kycBlockReasons: import("@/features/kyc/lib/kyc-api").KycEligibilityReason[];
  ringTone: "warning" | "success" | null;
  dialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  markFreshUser: () => void;
  markPhase1Complete: () => void;
  markPhase2Complete: () => void;
  markKycSubmitted: () => void;
  markKycVerified: (panNumber?: string) => void;
  applyReadinessCheck: (result: KycReadinessCheckResponse) => void;
  refreshFromBootstrap: () => Promise<void>;
  resumeAfterDigilocker: () => void;
  resumeAfterKycSubmission: () => void;
  digilockerResumeToken: number;
  kycSubmissionResumeToken: number;
};

const KycContext = createContext<KycContextValue | null>(null);

function getKycBlockReasons(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  const reasons: import("@/features/kyc/lib/kyc-api").KycEligibilityReason[] = [];
  if (user.account_status !== "active") {
    reasons.push("account_inactive");
  }
  if (!user.email_verified_at) {
    reasons.push("email_not_verified");
  }
  if (!user.phone_verified_at) {
    reasons.push("phone_not_verified");
  }
  if (!user.mfa_enrolled) {
    reasons.push("mfa_required");
  }
  if (!user.pin_enrolled) {
    reasons.push("pin_required");
  }
  return reasons;
}

function recordFromBootstrap(payload: KycBootstrapResponse): KycRecord {
  const overall = payload.step_statuses?.overall ?? "none";
  let status: KycStatus = "none";

  if (overall === "completed") {
    status = "complete";
  } else if (
    overall === "submitted" ||
    overall === "in_progress" ||
    overall === "phase1_complete" ||
    overall === "phase2_complete"
  ) {
    status = "pending";
  }

  return {
    status,
    panNumber: payload.pan_draft?.panNumber,
    submittedAt: overall === "submitted" ? new Date().toISOString() : undefined,
    completedAt: overall === "completed" ? new Date().toISOString() : undefined,
  };
}

function getRingTone(record: KycRecord | null): "warning" | "success" | null {
  if (!record) return null;
  return record.status === "complete" ? "success" : "warning";
}

export function KycProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [record, setRecord] = useState<KycRecord | null>(null);
  const [overallStatus, setOverallStatus] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [digilockerResumeToken, setDigilockerResumeToken] = useState(0);
  const [kycSubmissionResumeToken, setKycSubmissionResumeToken] = useState(0);
  const previousUserIdRef = useRef<string | null>(null);
  const kycBlockReasons = user ? getKycBlockReasons(user) : [];
  const kycAllowed = Boolean(user && kycBlockReasons.length === 0);

  const applyBootstrap = useCallback((payload: KycBootstrapResponse) => {
    setOverallStatus(payload.step_statuses?.overall ?? null);
    if (!payload.eligible) {
      setRecord(null);
      return;
    }
    setRecord(recordFromBootstrap(payload));
  }, []);

  const refreshFromBootstrap = useCallback(async () => {
    if (!kycAllowed) return;
    await ensureKycToken();
    const payload = await fetchKycBootstrap();
    applyBootstrap(payload);
  }, [applyBootstrap, kycAllowed]);

  const applyReadinessCheck = useCallback(
    (result: KycReadinessCheckResponse) => {
      setOverallStatus(result.overall_status);
      if (result.kra_verified) {
        setRecord((current) => ({
          ...(current ?? { status: "complete" }),
          status: "complete",
          completedAt: new Date().toISOString(),
        }));
        void refreshUser();
        return;
      }
      setRecord((current) => ({
        ...(current ?? { status: "pending" }),
        status: "pending",
      }));
    },
    [refreshUser],
  );

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = nextUserId;

    if (!nextUserId) {
      setRecord(null);
      setOverallStatus(null);
      setDialogOpen(false);
      return;
    }

    if (previousUserId && previousUserId !== nextUserId) {
      setRecord(null);
      setOverallStatus(null);
      setDialogOpen(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user || !kycAllowed) return;
    void refreshFromBootstrap().catch(() => {
      setRecord((current) => current ?? { status: "none" });
    });
  }, [kycAllowed, refreshFromBootstrap, user]);

  useEffect(() => {
    if (!kycAllowed || overallStatus !== "submitted") return;

    let cancelled = false;

    const pollKraCompletion = async () => {
      try {
        const formStatus = await fetchKycFormStatus();
        if (cancelled) return;
        if (formStatus.next_action === "completed" || formStatus.kra_verified) {
          applyReadinessCheck({
            kra_verified: true,
            overall_status: "completed",
            message: formStatus.message ?? "Your KYC is verified at the KRA.",
            readiness: { status: "verified" },
          });
          await refreshFromBootstrap();
          return;
        }

        const result = await checkKycReadiness();
        if (cancelled) return;
        if (result.kra_verified) {
          applyReadinessCheck(result);
          await refreshFromBootstrap();
        }
      } catch {
        // Background poll — ignore transient errors.
      }
    };

    void pollKraCompletion();
    const intervalId = window.setInterval(() => void pollKraCompletion(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyReadinessCheck, kycAllowed, overallStatus, refreshFromBootstrap]);

  const openDialog = useCallback(() => {
    if (!kycAllowed) return;
    setDialogOpen(true);
  }, [kycAllowed]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const markFreshUser = useCallback(() => {
    setRecord({ status: "none" });
    setOverallStatus(null);
  }, []);

  const markPhase1Complete = useCallback(() => {
    setRecord((current) => ({
      ...(current ?? { status: "pending" }),
      status: "pending",
      submittedAt: new Date().toISOString(),
    }));
    setOverallStatus("phase1_complete");
  }, []);

  const markPhase2Complete = useCallback(() => {
    setRecord((current) => ({
      ...(current ?? { status: "pending" }),
      status: "pending",
      submittedAt: new Date().toISOString(),
    }));
    setOverallStatus("phase2_complete");
  }, []);

  const markKycSubmitted = useCallback(() => {
    setRecord((current) => ({
      ...(current ?? { status: "pending" }),
      status: "pending",
      submittedAt: new Date().toISOString(),
    }));
    setOverallStatus("submitted");
  }, []);

  const markKycVerified = useCallback(
    (panNumber?: string) => {
      setRecord((current) => ({
        ...(current ?? { status: "complete" }),
        status: "complete",
        panNumber: panNumber ?? current?.panNumber,
        completedAt: new Date().toISOString(),
      }));
      setOverallStatus("completed");
      void refreshUser();
    },
    [refreshUser],
  );

  const resumeAfterDigilocker = useCallback(() => {
    setDigilockerResumeToken((current) => current + 1);
    setDialogOpen(true);
  }, []);

  const resumeAfterKycSubmission = useCallback(() => {
    setKycSubmissionResumeToken((current) => current + 1);
    setDialogOpen(true);
  }, []);

  const value = useMemo<KycContextValue>(() => {
    const status = record?.status ?? null;

    return {
      status,
      record,
      overallStatus,
      showRing: Boolean(user && record),
      showKycMenu: Boolean(user && record && record.status !== "complete"),
      kycAllowed,
      kycBlockReasons,
      ringTone: getRingTone(record),
      dialogOpen,
      openDialog,
      closeDialog,
      markFreshUser,
      markPhase1Complete,
      markPhase2Complete,
      markKycSubmitted,
      markKycVerified,
      applyReadinessCheck,
      refreshFromBootstrap,
      resumeAfterDigilocker,
      resumeAfterKycSubmission,
      digilockerResumeToken,
      kycSubmissionResumeToken,
    };
  }, [
    applyReadinessCheck,
    closeDialog,
    dialogOpen,
    digilockerResumeToken,
    kycSubmissionResumeToken,
    kycAllowed,
    kycBlockReasons,
    markFreshUser,
    markPhase1Complete,
    markPhase2Complete,
    markKycSubmitted,
    markKycVerified,
    openDialog,
    overallStatus,
    record,
    refreshFromBootstrap,
    resumeAfterDigilocker,
    user,
  ]);

  return <KycContext.Provider value={value}>{children}</KycContext.Provider>;
}

export function useKyc() {
  const context = useContext(KycContext);
  if (!context) {
    throw new Error("useKyc must be used within KycProvider");
  }
  return context;
}

export function useKycOptional() {
  return useContext(KycContext);
}
