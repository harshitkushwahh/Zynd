"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import { switchMfSipPlanBank, type MfSipPlan } from "@/features/invest/api/invest-api";
import { MfBankAccountPicker } from "@/features/invest/components/mf-bank-account-picker";
import { useAddBankAccountAction } from "@/features/invest/hooks/use-add-bank-account-action";
import {
  fetchInvestorBankAccounts,
  isInvestorBankAccountPaymentReady,
  type InvestorBankAccount,
} from "@/features/invest/lib/investor-bank-accounts-api";
import { copy } from "@/shared/config/copy";

type MfSipPlanBankSwitchDialogProps = {
  open: boolean;
  plan: MfSipPlan;
  currentBankAccountId: string | null;
  onOpenChange: (open: boolean) => void;
  onSwitchStarted: (plan: MfSipPlan) => void;
};

function createIdempotencyKey(planId: string) {
  return `sip-bank-switch:${planId}:${Date.now()}`;
}

export function MfSipPlanBankSwitchDialog({
  open,
  plan,
  currentBankAccountId,
  onOpenChange,
  onSwitchStarted,
}: MfSipPlanBankSwitchDialogProps) {
  const [accounts, setAccounts] = useState<InvestorBankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { canAddAccount, requestAddBankAccount } = useAddBankAccountAction({
    accounts,
    onAccountAdded: () => {
      void fetchInvestorBankAccounts()
        .then((result) => setAccounts(result.bank_accounts))
        .catch(() => setAccounts([]));
    },
  });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingAccounts(true);
    setError(null);
    setSelectedId(null);

    void fetchInvestorBankAccounts()
      .then((result) => {
        if (!cancelled) setAccounts(result.bank_accounts);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const eligibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          isInvestorBankAccountPaymentReady(account) &&
          account.id !== currentBankAccountId,
      ),
    [accounts, currentBankAccountId],
  );

  useEffect(() => {
    if (!open || selectedId) return;
    const primary = eligibleAccounts.find((account) => account.is_primary);
    setSelectedId(primary?.id ?? eligibleAccounts[0]?.id ?? null);
  }, [eligibleAccounts, open, selectedId]);

  const handleSubmit = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await switchMfSipPlanBank(plan.plan_id, {
        bank_account_id: selectedId,
        mandate_type: "upi",
        idempotency_key: createIdempotencyKey(plan.plan_id),
      });
      onOpenChange(false);
      onSwitchStarted(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mySips.bankSwitch.failed);
    } finally {
      setSubmitting(false);
    }
  };

  const showEmptyEligibleState = eligibleAccounts.length === 0 && !loadingAccounts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.mySips.bankSwitch.dialogTitle}</DialogTitle>
          <DialogDescription>{copy.mySips.bankSwitch.dialogDescription}</DialogDescription>
        </DialogHeader>

        {showEmptyEligibleState ? (
          <div className="space-y-3">
            <FieldMessage message={copy.mySips.bankSwitch.noAccounts} />
            {canAddAccount ? (
              <Button type="button" className="w-full" onClick={requestAddBankAccount}>
                {copy.mutualFunds.bankPickerAddAccount}
              </Button>
            ) : null}
          </div>
        ) : (
          <MfBankAccountPicker
            accounts={eligibleAccounts}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loadingAccounts}
            label={copy.mySips.bankSwitch.selectBank}
            onAddAccount={requestAddBankAccount}
            canAddAccount={canAddAccount}
          />
        )}

        {error ? <FieldMessage variant="error" message={error} /> : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose render={<Button type="button" variant="outline" />}>
            {copy.settings.bankAccounts.cancelAdd}
          </DialogClose>
          <Button
            type="button"
            disabled={!selectedId || submitting || eligibleAccounts.length === 0}
            onClick={() => void handleSubmit()}
          >
            {submitting ? copy.settings.working : copy.mySips.bankSwitch.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
