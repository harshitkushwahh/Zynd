"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DUMMY_BRANCH_DISTRIBUTORS } from "@/lib/dummy/branch-distributors";
import {
  readResidentAssignments,
  writeResidentAssignments,
  type ResidentDistributorAssignment,
} from "@/lib/resident-distributor-assignment";

type ResidentDistributorAssignmentContextValue = {
  assignments: Record<string, ResidentDistributorAssignment>;
  getAssignment: (investorId: string) => ResidentDistributorAssignment | undefined;
  requestAssignment: (investorId: string, distributorId: string) => void;
  confirmAssignment: (investorId: string) => void;
  clearAssignment: (investorId: string) => void;
};

const ResidentDistributorAssignmentContext =
  createContext<ResidentDistributorAssignmentContextValue | null>(null);

export function ResidentDistributorAssignmentProvider({ children }: { children: ReactNode }) {
  const [assignments, setAssignments] = useState<Record<string, ResidentDistributorAssignment>>(
    {},
  );

  useEffect(() => {
    setAssignments(readResidentAssignments());
  }, []);

  const persist = useCallback((next: Record<string, ResidentDistributorAssignment>) => {
    setAssignments(next);
    writeResidentAssignments(next);
  }, []);

  const requestAssignment = useCallback(
    (investorId: string, distributorId: string) => {
      const distributor = DUMMY_BRANCH_DISTRIBUTORS.find((row) => row.id === distributorId);
      if (!distributor) return;
      const record: ResidentDistributorAssignment = {
        investorId,
        distributorId,
        distributorName: distributor.name,
        distributorArn: distributor.arn,
        status: "pending_confirmation",
        magicLinkSentAt: new Date().toISOString(),
      };
      persist({ ...readResidentAssignments(), [investorId]: record });
    },
    [persist],
  );

  const confirmAssignment = useCallback(
    (investorId: string) => {
      const current = readResidentAssignments()[investorId];
      if (!current || current.status !== "pending_confirmation") return;
      persist({
        ...readResidentAssignments(),
        [investorId]: {
          ...current,
          status: "assigned",
          confirmedAt: new Date().toISOString(),
        },
      });
    },
    [persist],
  );

  const clearAssignment = useCallback(
    (investorId: string) => {
      const next = { ...readResidentAssignments() };
      delete next[investorId];
      persist(next);
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      assignments,
      getAssignment: (investorId: string) => assignments[investorId],
      requestAssignment,
      confirmAssignment,
      clearAssignment,
    }),
    [assignments, requestAssignment, confirmAssignment, clearAssignment],
  );

  return (
    <ResidentDistributorAssignmentContext.Provider value={value}>
      {children}
    </ResidentDistributorAssignmentContext.Provider>
  );
}

export function useResidentDistributorAssignment() {
  const ctx = useContext(ResidentDistributorAssignmentContext);
  if (!ctx) {
    throw new Error("useResidentDistributorAssignment must be used within provider");
  }
  return ctx;
}

export function useOptionalResidentDistributorAssignment() {
  return useContext(ResidentDistributorAssignmentContext);
}
