"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { HandCoins, Loader2, ShoppingCart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { applyMitraTxnRecommendation } from "@/features/recommendations/api/mitra-txn-recommendation-api";
import { useMitraTxnRecommendationQuery } from "@/features/recommendations/hooks/use-mitra-txn-recommendation-query";
import { formatInr } from "@/features/invest/lib/mf-format";
import { fetchMfCart } from "@/features/invest/api/invest-api";
import { syncMfCartQueryData } from "@/features/invest/hooks/use-mf-cart-query";
import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type MitraTxnRecommendationPageProps = {
  token: string;
};

function formatPaymentMethod(method: string) {
  if (method === "upi") return "UPI";
  if (method === "netbanking") return "Net banking";
  return method;
}

function formatInvestmentType(type: string) {
  return type === "sip" ? "SIP" : "One-time";
}

function formatExpiryLabel(expiresAt: string) {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveLoadError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return {
      title: "Could not load recommendation",
      description: "Something went wrong while loading this recommendation.",
    };
  }

  if (error.status === 404) {
    return {
      title: "Recommendation not found",
      description: "This link may be invalid or has already been removed.",
    };
  }

  if (error.status === 403) {
    return {
      title: "This recommendation is not for your account",
      description: "Sign in with the investor account your Mitra used when sending this link.",
    };
  }

  if (error.status === 410 || error.code === "expired" || error.code === "cancelled") {
    return {
      title: "This recommendation is no longer active",
      description: error.message || "The link may have expired or been cancelled.",
    };
  }

  return {
    title: "Could not load recommendation",
    description: error.message,
  };
}

export function MitraTxnRecommendationPage({ token }: MitraTxnRecommendationPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recommendationQuery = useMitraTxnRecommendationQuery(token);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const handleApply = useCallback(async () => {
    setIsApplying(true);
    setApplyError(null);
    try {
      const response = await applyMitraTxnRecommendation(token);
      const cart = await fetchMfCart();
      syncMfCartQueryData(queryClient, cart);
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.mitraTxnRecommendation(token) });
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
  }, [queryClient, router, token]);

  const recommendation = recommendationQuery.data;
  const isInactive =
    recommendation?.status === "expired" ||
    recommendation?.status === "cancelled" ||
    recommendation?.status === "invested";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        icon={HandCoins}
        title="Mitra investment recommendation"
        description="Review the fund and amount your Mitra suggested, then continue to your cart to complete the investment."
        loading={recommendationQuery.isLoading}
      />

      {recommendationQuery.isLoading ? (
        <section className="rounded-[var(--radius-card)] border border-border bg-card p-6">
          <div className="flex items-center gap-3 text-compact text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading recommendation…
          </div>
        </section>
      ) : null}

      {recommendationQuery.isError ? (
        <LoadErrorCard
          {...resolveLoadError(recommendationQuery.error)}
          retryLabel="Try again"
          onRetry={() => void recommendationQuery.refetch()}
          retryLoading={recommendationQuery.isFetching}
          backAction={
            <Button type="button" variant="secondary" nativeButton={false} render={<Link href="/dashboard/mutual-funds" />}>
              Back to mutual funds
            </Button>
          }
        />
      ) : null}

      {recommendation ? (
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          <div className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              Recommended by your Mitra
            </p>
            <h2 className="mt-1 text-h4 font-semibold tracking-tight text-foreground">
              {recommendation.item_count === 1
                ? recommendation.fund_name
                : `${recommendation.item_count} funds in your cart`}
            </h2>
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
                {formatInvestmentType(recommendation.investment_type)}
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
                {formatPaymentMethod(recommendation.payment_method)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Status</dt>
              <dd className="mt-1 text-compact font-medium capitalize text-foreground">{recommendation.status}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Valid until</dt>
              <dd className="mt-1 text-compact font-medium text-foreground">
                {formatExpiryLabel(recommendation.expires_at)}
              </dd>
            </div>
          </dl>

          <div className="border-t border-border px-5 py-5 sm:px-6">
            {applyError ? (
              <p className="mb-4 rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 px-3 py-2 text-compact text-destructive">
                {applyError}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                className={cn("sm:min-w-48")}
                disabled={isApplying || isInactive}
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
              <Button
                type="button"
                variant="secondary"
                nativeButton={false}
                render={<Link href={recommendation.cart_path} />}
              >
                View cart
              </Button>
            </div>

            {isInactive ? (
              <p className="mt-3 text-caption text-muted-foreground">
                This recommendation can no longer be applied. Ask your Mitra for a fresh link if you still want to invest.
              </p>
            ) : (
              <p className="mt-3 text-caption text-muted-foreground">
                We will prefill your cart with {recommendation.item_count} fund
                {recommendation.item_count === 1 ? "" : "s"} and the amounts above. You can review everything before
                placing the order.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
