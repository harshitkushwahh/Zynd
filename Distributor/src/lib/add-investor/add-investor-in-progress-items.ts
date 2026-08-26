import type { AddInvestorComplianceDraft } from "@/lib/add-investor/add-investor-compliance-storage";
import type { AddInvestorStepId } from "@/lib/add-investor/add-investor-journey";
import {
  formatInvestorClientCodeDisplay,
  isPlaceholderInvestorClientCode,
  resolveInvestorClientCodeDisplay,
} from "@/lib/add-investor/add-investor-client-code";
import type { DistributorInvestor } from "@/lib/distributor-types";

export type AddInvestorInProgressItem = {
  id: string;
  label: string;
  clientCode: string;
  stepLabel: string;
  draft?: AddInvestorComplianceDraft;
  investor?: DistributorInvestor;
};

export function buildAddInvestorInProgressItems(
  localDraft: AddInvestorComplianceDraft | null,
  pendingInvestors: DistributorInvestor[],
  stepLabels: Record<AddInvestorStepId, string>,
): AddInvestorInProgressItem[] {
  const items = new Map<string, AddInvestorInProgressItem>();

  if (localDraft) {
    const id = localDraft.clientUserId.trim().toLowerCase();
    items.set(id, {
      id: localDraft.clientUserId,
      label: localDraft.investorName.trim() || localDraft.email.trim() || "Investor draft",
      clientCode: resolveInvestorClientCodeDisplay(
        localDraft.clientId,
        localDraft.email,
        localDraft.mobile,
      ),
      stepLabel: stepLabels[localDraft.stepId],
      draft: localDraft,
    });
  }

  for (const investor of pendingInvestors) {
    const id = investor.id.trim().toLowerCase();
    if (
      localDraft &&
      id !== localDraft.clientUserId.trim().toLowerCase() &&
      isPlaceholderInvestorClientCode(investor.clientCode)
    ) {
      continue;
    }
    const existing = items.get(id);
    if (existing) {
      items.set(id, {
        ...existing,
        label:
          existing.label === "Investor draft" || isPlaceholderLabel(existing.label)
            ? investor.emailMasked
            : existing.label,
        clientCode:
          existing.clientCode === "—"
            ? formatInvestorClientCodeDisplay(investor.clientCode)
            : existing.clientCode,
        investor,
      });
      continue;
    }

    items.set(id, {
      id: investor.id,
      label: investor.emailMasked,
      clientCode: formatInvestorClientCodeDisplay(investor.clientCode),
      stepLabel: "KYC pending",
      investor,
    });
  }

  return Array.from(items.values());
}

function isPlaceholderLabel(label: string): boolean {
  return label.includes("@zynd") && label.startsWith("test-");
}
