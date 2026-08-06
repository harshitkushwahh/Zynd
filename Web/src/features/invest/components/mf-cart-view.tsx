"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  IndianRupee,
  Info,
  Loader2,
  ReceiptIndianRupee,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  checkoutMfCart,
  checkoutMfSipCart,
  clearMfCartTab,
  fetchMfCart,
  removeMfCartItem,
  type MfCart,
  type MfCartItem,
  type MfMandateType,
  type MfPaymentMethod,
} from "@/features/invest/api/invest-api";
import { MfBankAccountPicker } from "@/features/invest/components/mf-bank-account-picker";
import { MfBreadcrumb } from "@/features/invest/components/mf-breadcrumb";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfMandateTypePicker } from "@/features/invest/components/mf-mandate-type-picker";
import { MfPaymentMethodPicker } from "@/features/invest/components/mf-payment-method-picker";
import { formatInstallmentDuration } from "@/features/invest/lib/mf-sip-calculator";
import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { usePaymentReadyBankAccounts } from "@/features/invest/hooks/use-payment-ready-bank-accounts";
import { markMfSipCartCheckoutPlans } from "@/features/invest/lib/mf-payment-session";
import { setMfCartQueryData } from "@/features/invest/hooks/use-mf-cart-query";
import { invalidateInvestQueries } from "@/features/invest/lib/invalidate-invest-queries";
import { formatInr } from "@/features/invest/lib/mf-format";
import {
  MF_CARD_RADIUS_CLASS,
  MF_INVEST_PAYMENT_CARD_CLASS,
  MF_PAGE_SECTION_CLASS,
} from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type CartTab = "lumpsum" | "sip";

function CartTabPanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      aria-hidden={!active}
      className={cn(
        "col-start-1 row-start-1 min-w-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
        active ? "relative z-10 opacity-100" : "pointer-events-none invisible opacity-0",
      )}
    >
      {children}
    </div>
  );
}

function CartTabToggle({
  tab,
  onChange,
  lumpsumCount,
  sipCount,
}: {
  tab: CartTab;
  onChange: (tab: CartTab) => void;
  lumpsumCount: number;
  sipCount: number;
}) {
  const options = [
    { id: "lumpsum" as const, label: copy.mutualFunds.paymentCardOneTime, count: lumpsumCount },
    { id: "sip" as const, label: copy.mutualFunds.paymentCardMonthlySip, count: sipCount },
  ];

  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.cartTitle}
      className="grid max-w-md grid-cols-2 gap-1 rounded-full border border-border/80 bg-muted/20 p-1"
    >
      {options.map((option) => {
        const isActive = tab === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-compact font-medium",
              "transition-[color,background-color,box-shadow,opacity] duration-200 ease-out motion-reduce:transition-none",
              isActive
                ? "bg-foreground text-background shadow-zynd-low"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{option.label}</span>
            <span
              className={cn(
                "flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                isActive ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
              )}
            >
              {option.count > 9 ? "9+" : option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CartItemRow({
  item,
  tab,
  removingProductId,
  onRemove,
}: {
  item: MfCartItem;
  tab: CartTab;
  removingProductId: string | null;
  onRemove: (productId: string) => void;
}) {
  const name = item.product_name ?? copy.mutualFunds.unknownFund;
  const amcName = item.amc_name ?? name;

  return (
    <li
      className={cn(
        "flex items-start gap-3 border border-border bg-card p-4 sm:gap-4 sm:p-5",
        MF_CARD_RADIUS_CLASS,
      )}
    >
      <MfFundAmcAvatar
        amcLogoUrl={item.amc_logo_url}
        amcName={amcName}
        className="size-11 shrink-0 text-caption"
      />

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-compact font-medium leading-snug text-foreground">{name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-body font-semibold tabular-nums text-foreground">
            {formatInr(item.amount_inr)}
          </span>
          {tab === "sip" && item.installment_day ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <CalendarDays className="size-3" />
              {copy.mutualFunds.sipInstallmentDay.replace("{day}", String(item.installment_day))}
            </Badge>
          ) : null}
          {tab === "sip" && item.number_of_installments ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              {formatInstallmentDuration(item.number_of_installments)}
            </Badge>
          ) : null}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        disabled={removingProductId === item.product_id}
        onClick={() => onRemove(item.product_id)}
        aria-label={copy.mutualFunds.cartRemoveItem}
      >
        {removingProductId === item.product_id ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </Button>
    </li>
  );
}

function CartItemsList({
  items,
  tab,
  removingProductId,
  onRemove,
}: {
  items: MfCartItem[];
  tab: CartTab;
  removingProductId: string | null;
  onRemove: (productId: string) => void;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <CartItemRow
          key={`${item.product_id}-${item.investment_type}`}
          item={item}
          tab={tab}
          removingProductId={removingProductId}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}

function CartEmptyState({ tab }: { tab: CartTab }) {
  const isLumpsum = tab === "lumpsum";

  return (
    <div
      className={cn(
        "flex flex-col items-center border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center sm:py-16",
        MF_CARD_RADIUS_CLASS,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <ShoppingCart className="size-6" strokeWidth={1.75} />
      </div>
      <p className="mt-5 text-body font-semibold text-foreground">
        {isLumpsum ? copy.mutualFunds.cartEmptyTitle : copy.mutualFunds.cartSipEmptyTitle}
      </p>
      <p className="mt-2 max-w-sm text-compact leading-relaxed text-muted-foreground">
        {isLumpsum ? copy.mutualFunds.cartEmptyHint : copy.mutualFunds.cartSipEmptyHint}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button nativeButton={false} render={<Link href="/dashboard/mutual-funds/all" />}>
          {copy.mutualFunds.cartBrowseFunds}
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard/mutual-funds" />}
        >
          {copy.mutualFunds.cartExploreHome}
        </Button>
      </div>
    </div>
  );
}

function CartLoadingSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
      <Skeleton className={cn("h-[14rem] w-full", MF_CARD_RADIUS_CLASS)} />
      <Skeleton className={cn("h-[22rem] w-full", MF_CARD_RADIUS_CLASS)} />
    </div>
  );
}

function CartCheckoutPanel({
  tab,
  activeCount,
  activeTotal,
  checkingOut,
  banksLoading,
  hasPaymentReadyAccount,
  accounts,
  selectedBankAccountId,
  onSelectBankAccount,
  banksError,
  onCheckout,
  paymentMethod,
  onPaymentMethodChange,
  mandateType,
  onMandateTypeChange,
  isEmpty = false,
  className,
}: {
  tab: CartTab;
  activeCount: number;
  activeTotal: number;
  checkingOut: boolean;
  banksLoading: boolean;
  hasPaymentReadyAccount: boolean;
  accounts: ReturnType<typeof usePaymentReadyBankAccounts>["accounts"];
  selectedBankAccountId: string | null;
  onSelectBankAccount: (id: string) => void;
  banksError: string | null;
  onCheckout: () => void;
  paymentMethod: MfPaymentMethod;
  onPaymentMethodChange: (value: MfPaymentMethod) => void;
  mandateType: MfMandateType;
  onMandateTypeChange: (value: MfMandateType) => void;
  isEmpty?: boolean;
  className?: string;
}) {
  const checkoutDisabled = isEmpty || checkingOut || banksLoading || !hasPaymentReadyAccount;

  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col overflow-hidden xl:sticky xl:top-6 xl:self-start",
        MF_INVEST_PAYMENT_CARD_CLASS,
        MF_CARD_RADIUS_CLASS,
        className,
      )}
      aria-disabled={isEmpty || undefined}
    >
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-muted/10 px-5 py-4 dark:border-zinc-700/80">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-foreground ring-1 ring-border/80">
          <ReceiptIndianRupee className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-compact font-semibold text-foreground">{copy.mutualFunds.cartOrderSummary}</p>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {copy.mutualFunds.cartItemCount.replace("{count}", String(activeCount))}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div
          className={cn(
            "rounded-[var(--radius-card)] border border-border/80 bg-muted/15 px-4 py-4",
            !isEmpty && "border-primary/15 bg-primary/[0.03]",
          )}
        >
          <div className="flex items-center gap-2 text-caption font-medium text-muted-foreground">
            <IndianRupee className="size-3.5 shrink-0" aria-hidden="true" />
            {copy.mutualFunds.cartTotalLabel}
          </div>
          <p
            className={cn(
              "mt-2 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums",
              isEmpty ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {isEmpty ? "NA" : formatInr(activeTotal)}
          </p>
        </div>

        <div className="flex gap-3 rounded-[var(--radius-card)] border border-border/70 bg-muted/10 px-3.5 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="grid min-w-0 flex-1 [&>*]:col-start-1 [&>*]:row-start-1">
            <p
              className={cn(
                "col-start-1 row-start-1 text-caption leading-relaxed text-muted-foreground transition-opacity duration-200 ease-out motion-reduce:transition-none",
                tab === "lumpsum" ? "opacity-100" : "pointer-events-none invisible opacity-0",
              )}
            >
              {copy.mutualFunds.cartSinglePaymentHint}
            </p>
            <p
              className={cn(
                "col-start-1 row-start-1 text-caption leading-relaxed text-muted-foreground transition-opacity duration-200 ease-out motion-reduce:transition-none",
                tab === "sip" ? "opacity-100" : "pointer-events-none invisible opacity-0",
              )}
            >
              {copy.mutualFunds.cartSipCheckoutHint}
            </p>
          </div>
        </div>

        <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
          <div
            className={cn(
              "col-start-1 row-start-1 transition-opacity duration-200 ease-out motion-reduce:transition-none",
              tab === "lumpsum" ? "opacity-100" : "pointer-events-none invisible opacity-0",
            )}
          >
            <MfPaymentMethodPicker
              value={paymentMethod}
              onChange={onPaymentMethodChange}
              disabled={checkoutDisabled}
            />
          </div>
          <div
            className={cn(
              "col-start-1 row-start-1 transition-opacity duration-200 ease-out motion-reduce:transition-none",
              tab === "sip" ? "opacity-100" : "pointer-events-none invisible opacity-0",
            )}
          >
            <MfMandateTypePicker
              value={mandateType}
              onChange={onMandateTypeChange}
              disabled={checkoutDisabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <MfBankAccountPicker
              accounts={accounts}
              selectedId={selectedBankAccountId}
              onSelect={onSelectBankAccount}
              loading={banksLoading}
              error={banksError}
              disabled={checkoutDisabled}
              hint=""
              label=""
          />
        </div>

        <Button
          className="h-11 w-full rounded-[var(--radius-control)] shadow-zynd-low"
          disabled={checkoutDisabled}
          onClick={onCheckout}
        >
          {checkingOut ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {tab === "lumpsum" ? copy.mutualFunds.cartCheckoutCta : copy.mutualFunds.cartSipCheckoutCta}
          {!checkingOut ? <ArrowRight className="ml-2 size-4" /> : null}
        </Button>
      </div>
    </aside>
  );
}

export function MfCartView() {
  const queryClient = useQueryClient();
  const { openCartCheckoutPayment, openSipMandate } = useMfPaymentOverlay();
  const [cart, setCart] = useState<MfCart | null>(null);
  const [tab, setTab] = useState<CartTab>("lumpsum");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);
  const [clearingTab, setClearingTab] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<MfPaymentMethod>("upi");
  const [mandateType, setMandateType] = useState<MfMandateType>("upi");
  const {
    accounts,
    selectedBankAccountId,
    setSelectedBankAccountId,
    loading: banksLoading,
    error: banksError,
    hasPaymentReadyAccount,
  } = usePaymentReadyBankAccounts(true);

  const loadCart = useCallback(async () => {
    try {
      const next = await fetchMfCart();
      setCart(next);
      setMfCartQueryData(queryClient, next);
      setError(null);
      if (next.lumpsum_item_count === 0 && next.sip_item_count > 0) {
        setTab("sip");
      }
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.cartLoadError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const lumpsumItems = cart?.lumpsum_items ?? [];
  const sipItems = cart?.sip_items ?? [];
  const lumpsumCount = cart?.lumpsum_item_count ?? 0;
  const sipCount = cart?.sip_item_count ?? 0;
  const activeCount = tab === "lumpsum" ? lumpsumCount : sipCount;
  const totalItemCount = cart?.item_count ?? 0;

  async function handleRemove(productId: string) {
    setRemovingProductId(productId);
    try {
      const next = await removeMfCartItem(productId, tab);
      setCart(next);
      setMfCartQueryData(queryClient, next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.cartRemoveFailed);
    } finally {
      setRemovingProductId(null);
    }
  }

  async function handleClearTab() {
    if (activeCount === 0) return;
    setClearingTab(true);
    try {
      const next = await clearMfCartTab(tab);
      setCart(next);
      setMfCartQueryData(queryClient, next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.cartClearFailed);
    } finally {
      setClearingTab(false);
    }
  }

  async function handleCheckout() {
    if (!cart || activeCount === 0) return;
    if (!hasPaymentReadyAccount || !selectedBankAccountId) {
      setError(copy.mutualFunds.bankPickerEmpty);
      return;
    }
    setCheckingOut(true);
    setError(null);
    try {
      if (tab === "lumpsum") {
        const checkout = await checkoutMfCart({
          idempotency_key: crypto.randomUUID(),
          bank_account_id: selectedBankAccountId,
          payment_method: paymentMethod,
        });
        openCartCheckoutPayment(checkout.checkout_id);
        return;
      }

      const result = await checkoutMfSipCart({
        idempotency_key: crypto.randomUUID(),
        bank_account_id: selectedBankAccountId,
        mandate_type: mandateType,
      });
      const firstPlan = result.plans[0];
      if (!firstPlan) {
        setError(copy.mutualFunds.cartCheckoutFailed);
        return;
      }
      markMfSipCartCheckoutPlans(result.plans.map((plan) => plan.plan_id));
      void invalidateInvestQueries(queryClient);
      openSipMandate(firstPlan.plan_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.cartCheckoutFailed);
    } finally {
      setCheckingOut(false);
    }
  }

  const clearDisabled = activeCount === 0 || clearingTab || removingProductId !== null || checkingOut;

  if (loading) {
    return (
      <div className={cn(MF_PAGE_SECTION_CLASS, "w-full min-w-0 max-w-full space-y-6")}>
        <MfBreadcrumb trail={[{ label: copy.mutualFunds.cartTitle }]} />
        <CartLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className={cn(MF_PAGE_SECTION_CLASS, "w-full min-w-0 max-w-full space-y-6 pb-8")}>
      <MfBreadcrumb trail={[{ label: copy.mutualFunds.cartTitle }]} />
      <FundEligibilityBanner />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <PageTitle>{copy.mutualFunds.cartTitle}</PageTitle>
            {totalItemCount > 0 ? (
              <Badge variant="secondary" className="font-normal tabular-nums">
                {copy.mutualFunds.cartItemCount.replace("{count}", String(totalItemCount))}
              </Badge>
            ) : null}
          </div>
          <div className="relative mt-2 min-h-[2.75rem]">
            <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
              <p
                className={cn(
                  "col-start-1 row-start-1 flex items-start gap-2 text-compact leading-relaxed text-muted-foreground transition-opacity duration-200 ease-out motion-reduce:transition-none",
                  tab === "lumpsum" ? "opacity-100" : "pointer-events-none invisible opacity-0",
                )}
              >
                <Wallet className="mt-0.5 size-4 shrink-0" aria-hidden />
                {copy.mutualFunds.cartDescription}
              </p>
              <p
                className={cn(
                  "col-start-1 row-start-1 flex items-start gap-2 text-compact leading-relaxed text-muted-foreground transition-opacity duration-200 ease-out motion-reduce:transition-none",
                  tab === "sip" ? "opacity-100" : "pointer-events-none invisible opacity-0",
                )}
              >
                <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
                {copy.mutualFunds.cartSipDescription}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CartTabToggle
          tab={tab}
          onChange={setTab}
          lumpsumCount={lumpsumCount}
          sipCount={sipCount}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          disabled={clearDisabled}
          onClick={() => void handleClearTab()}
        >
          {clearingTab ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          {copy.mutualFunds.cartClearTab}
        </Button>
      </div>

      {error ? <FieldMessage variant="error" message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <div className="grid min-w-0 [&>*]:col-start-1 [&>*]:row-start-1">
          <CartTabPanel active={tab === "lumpsum"}>
            {lumpsumCount === 0 ? (
              <CartEmptyState tab="lumpsum" />
            ) : (
              <CartItemsList
                items={lumpsumItems}
                tab="lumpsum"
                removingProductId={removingProductId}
                onRemove={handleRemove}
              />
            )}
          </CartTabPanel>
          <CartTabPanel active={tab === "sip"}>
            {sipCount === 0 ? (
              <CartEmptyState tab="sip" />
            ) : (
              <CartItemsList
                items={sipItems}
                tab="sip"
                removingProductId={removingProductId}
                onRemove={handleRemove}
              />
            )}
          </CartTabPanel>
        </div>

        <div className="grid min-w-0 [&>*]:col-start-1 [&>*]:row-start-1">
          <CartCheckoutPanel
            tab="lumpsum"
            activeCount={lumpsumCount}
            activeTotal={cart?.lumpsum_total_amount_inr ?? 0}
            checkingOut={checkingOut}
            banksLoading={banksLoading}
            hasPaymentReadyAccount={hasPaymentReadyAccount}
            accounts={accounts}
            selectedBankAccountId={selectedBankAccountId}
            onSelectBankAccount={setSelectedBankAccountId}
            banksError={banksError}
            onCheckout={() => void handleCheckout()}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            mandateType={mandateType}
            onMandateTypeChange={setMandateType}
            isEmpty={lumpsumCount === 0}
            className={cn(
              "transition-opacity duration-200 ease-out motion-reduce:transition-none",
              tab === "lumpsum" ? "relative z-10 opacity-100" : "pointer-events-none invisible opacity-0",
            )}
          />
          <CartCheckoutPanel
            tab="sip"
            activeCount={sipCount}
            activeTotal={cart?.sip_total_amount_inr ?? 0}
            checkingOut={checkingOut}
            banksLoading={banksLoading}
            hasPaymentReadyAccount={hasPaymentReadyAccount}
            accounts={accounts}
            selectedBankAccountId={selectedBankAccountId}
            onSelectBankAccount={setSelectedBankAccountId}
            banksError={banksError}
            onCheckout={() => void handleCheckout()}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            mandateType={mandateType}
            onMandateTypeChange={setMandateType}
            isEmpty={sipCount === 0}
            className={cn(
              "transition-opacity duration-200 ease-out motion-reduce:transition-none",
              tab === "sip" ? "relative z-10 opacity-100" : "pointer-events-none invisible opacity-0",
            )}
          />
        </div>
      </div>
    </div>
  );
}
