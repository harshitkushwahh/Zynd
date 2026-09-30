"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { applyMitraTxnRecommendation } from "@/features/recommendations/api/mitra-txn-recommendation-api";
import { useMitraTxnRecommendationQuery } from "@/features/recommendations/hooks/use-mitra-txn-recommendation-query";
import {
  formatMitraRecommendationExpiryLabel,
  formatMitraRecommendationInvestmentType,
  formatMitraRecommendationPaymentMethod,
  resolveMitraRecommendationInactiveMessage,
  resolveMitraRecommendationLoadError,
} from "@/features/recommendations/lib/mitra-txn-recommendation-copy";
import { formatInr } from "@/features/invest/lib/mf-format";
import { fetchMfCart } from "@/features/invest/api/invest-api";
import { syncMfCartQueryData } from "@/features/invest/hooks/use-mf-cart-query";
import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type MitraTxnRecommendationDialogProps = {
  token: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DIALOG_TITLE = "Mitra investment recommendation";
const DIALOG_DESCRIPTION =
  "Review the fund and amount your Mitra suggested, then continue to your cart to complete the investment.";

export function MitraTxnRecommendationDialog({
  token,
  open,
  onOpenChange,
}: MitraTxnRecommendationDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recommendationQuery = useMitraTxnRecommendationQuery(token ?? "", open && Boolean(token));
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const handleDismiss = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleApply = useCallback(async () => {
    if (!token) return;

    setIsApplying(true);
    setApplyError(null);
    try {
      const response = await applyMitraTxnRecommendation(token);
      const cart = await fetchMfCart();
      syncMfCartQueryData(queryClient, cart);
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.mitraTxnRecommendation(token) });
      onOpenChange(false);
      router.push(response.redirect_path || "/dashboard/mutual-funds/cart");
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setApplyError(error.message);
      } else {
        setApplyError("Could not add this recommendation to your cart.");
      }
    } finally {
      setIsApplying(false);
    }
  }, [onOpenChange, queryClient, router, token]);

  if (!open || !token) return null;

  const recommendation = recommendationQuery.data;
  const isInactive =
    recommendation?.status === "expired" ||
    recommendation?.status === "cancelled" ||
    recommendation?.status === "invested";

  if (recommendationQuery.isError) {
    const errorCopy = resolveMitraRecommendationLoadError(recommendationQuery.error);
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        variant="info"
        title={errorCopy.title}
        description={errorCopy.description}
        doneLabel="Back to mutual funds"
        onConfirm={handleDismiss}
      />
    );
  }

  if (recommendation && isInactive) {
    const inactiveCopy = resolveMitraRecommendationInactiveMessage(recommendation.status);
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        variant="info"
        title={inactiveCopy.title}
        description={inactiveCopy.description}
        doneLabel="Back to mutual funds"
        onConfirm={handleDismiss}
      />
    );
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={DIALOG_TITLE}
      maxWidth="lg"
      className="max-h-[min(90vh,44rem)]"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <p className="border-b border-border px-5 py-4 text-compact leading-relaxed text-muted-foreground sm:px-6">
          {DIALOG_DESCRIPTION}
        </p>

        {recommendationQuery.isLoading ? (
          <div className="flex items-center gap-3 px-5 py-6 text-compact text-muted-foreground sm:px-6">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading recommendation…
          </div>
        ) : null}

        {recommendation ? (
          <div className="space-y-0">
            <div className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
              <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
                Recommended by your Mitra
              </p>
              <h3 className="mt-1 text-h4 font-semibold tracking-tight text-foreground">
                {recommendation.item_count === 1
                  ? recommendation.fund_name
                  : `${recommendation.item_count} funds in your cart`}
              </h3>
              {recommendation.item_count === 1 && recommendation.product_code ? (
                <p className="mt-1 font-mono text-micro text-muted-foreground">{recommendation.product_code}</p>
              ) : null}
            </div>

            {recommendation.items.length > 0 ? (
              <div className="border-b border-border px-5 py-4 sm:px-6">
                <p className="mb-3 text-caption font-medium uppercase tracking-wide text-muted-foreground">
                  Recommended funds
                </p>
                <ul className="space-y-3">
                  {recommendation.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[var(--radius-card)] border border-border bg-muted/15 px-3 py-3"
                    >
                      <p className="text-compact font-medium leading-snug text-foreground">{item.fund_name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
                        {item.product_code ? <span className="font-mono">{item.product_code}</span> : null}
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatInr(item.amount_inr)}
                        </span>
                        {recommendation.investment_type === "sip" && item.number_of_installments ? (
                          <span>{item.number_of_installments} installments</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
              <div>
                <dt className="text-caption text-muted-foreground">Investment type</dt>
                <dd className="mt-1 text-compact font-medium text-foreground">
                  {formatMitraRecommendationInvestmentType(recommendation.investment_type)}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Total amount</dt>
                <dd className="mt-1 text-compact font-semibold tabular-nums text-foreground">
                  {formatInr(recommendation.amount_inr)}
                </dd>
              </div>
              {recommendation.investment_type === "sip" && recommendation.number_of_installments ? (
                <div>
                  <dt className="text-caption text-muted-foreground">Installments</dt>
                  <dd className="mt-1 text-compact font-medium text-foreground">
                    {recommendation.number_of_installments} · {recommendation.sip_frequency}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-caption text-muted-foreground">Payment method</dt>
                <dd className="mt-1 text-compact font-medium text-foreground">
                  {formatMitraRecommendationPaymentMethod(recommendation.payment_method)}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Valid until</dt>
                <dd className="mt-1 text-compact font-medium text-foreground">
                  {formatMitraRecommendationExpiryLabel(recommendation.expires_at)}
                </dd>
              </div>
            </dl>

            {applyError ? (
              <p className="mx-5 mb-0 rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 px-3 py-2 text-compact text-destructive sm:mx-6">
                {applyError}
              </p>
            ) : null}

            <BrandDialogFooter className="border-t border-border px-5 py-5 sm:px-6">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  nativeButton={false}
                  render={<Link href={recommendation.cart_path} />}
                >
                  View cart
                </Button>
                <Button
                  type="button"
                  className={cn("sm:min-w-48")}
                  disabled={isApplying}
                  onClick={() => void handleApply()}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Adding to cart…
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="size-4" aria-hidden />
                      Continue to cart ({recommendation.item_count})
                    </>
                  )}
                </Button>
              </div>
              <p className="mt-3 w-full text-caption text-muted-foreground sm:text-right">
                We will prefill your cart with {recommendation.item_count} fund
                {recommendation.item_count === 1 ? "" : "s"} and the amounts above. You can review everything before
                placing the order.
              </p>
            </BrandDialogFooter>
          </div>
        ) : null}
      </div>
    </BrandDialog>
  );
}
