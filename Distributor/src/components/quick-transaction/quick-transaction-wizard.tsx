"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";
import {
  ArrowLeftRight,
  Ban,
  Check,
  CheckCircle2,
  ClipboardCheck,
  HandCoins,
  IndianRupee,
  Landmark,
  Layers3,
  Repeat2,
  Search,
  UserRound,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Selection, SortDescriptor } from "react-aria-components";

import { paginateTableItems, Table, TableCard, TableEmptyState } from "@/components/application/table";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { QuickTransactionSectionHeader } from "@/components/quick-transaction/quick-transaction-section-header";
import { QuickTransactionWizardSkeleton } from "@/components/quick-transaction/quick-transaction-wizard-skeleton";
import type { QuickTransactionWizardStepId } from "@/components/quick-transaction/quick-transaction-wizard-types";
import { useQuickTransactionPageReveal } from "@/components/quick-transaction/use-quick-transaction-page-reveal";
import { useQuickTransactionStepSwitch } from "@/components/quick-transaction/use-quick-transaction-step-switch";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorProfileAvatar } from "@/components/ui/distributor-profile-avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { amountInWordsInr } from "@/lib/amount-in-words";
import { useDistributorNotifications } from "@/contexts/distributor-notifications-context";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import { distributorClientPathRef } from "@/lib/distributor-client-routes";
import { resolveAmcLogoUrl } from "@/lib/distributor-asset-url";
import { fetchDistributorClients } from "@/lib/distributor-clients-api";
import { searchDistributorSchemes, QUICK_TXN_MAX_FUNDS } from "@/lib/distributor-txn-recommendations-api";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
} from "@/lib/distributor-layout";
import {
  filterDistributorBookInvestors,
  searchInvestors,
} from "@/lib/distributor-investor-utils";
import type { DistributorInvestor } from "@/lib/distributor-types";

import { formatAum, formatDistributorDate } from "@/lib/format";
import type { QuickTxnType } from "@/lib/quick-transaction-types";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { onboardingStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

type WizardStepId = QuickTransactionWizardStepId;

type WizardFund = {
  id: string;
  name: string;
  amc: string;
  amcSlug: string | null;
  amcLogoUrl: string | null;
  irn: string;
  minAmount: number;
  maxAmount: number;
  category: string;
  logoMark: string;
};

const WIZARD_FUND_MAX_AMOUNT = 10_000_000;

function mapApiSchemeToWizardFund(
  item: Awaited<ReturnType<typeof searchDistributorSchemes>>["items"][number],
  txnType: QuickTxnType,
): WizardFund {
  const minAmount =
    txnType === "sip"
      ? item.min_sip_amount_inr ?? item.min_lumpsum_amount_inr ?? 100
      : item.min_lumpsum_amount_inr ?? item.min_sip_amount_inr ?? 100;
  const mark = item.amc_name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return {
    id: item.product_id,
    name: item.name,
    amc: item.amc_name,
    amcSlug: item.amc_slug,
    amcLogoUrl: item.amc_logo_url,
    irn: item.product_code || item.isin,
    minAmount,
    maxAmount: WIZARD_FUND_MAX_AMOUNT,
    category: item.category_slug ?? "Mutual fund",
    logoMark: mark || "MF",
  };
}

function filterWizardFunds(funds: WizardFund[], query: string): WizardFund[] {
  const q = query.trim().toLowerCase();
  if (!q) return funds;
  return funds.filter(
    (scheme) =>
      scheme.name.toLowerCase().includes(q) ||
      scheme.amc.toLowerCase().includes(q) ||
      scheme.irn.toLowerCase().includes(q) ||
      scheme.category.toLowerCase().includes(q),
  );
}

const WIZARD_STEPS: Array<{ id: WizardStepId; label: string; description: string; icon: LucideIcon }> = [
  {
    id: "type",
    label: "Transaction type",
    description: "One time or SIP",
    icon: HandCoins,
  },
  {
    id: "investors",
    label: "Select investor",
    description: "Onboarded client",
    icon: UserRound,
  },
  {
    id: "funds",
    label: "Select funds",
    description: "Scheme & IRN",
    icon: Layers3,
  },
  {
    id: "amount",
    label: "Amount & payment",
    description: "Value & pay mode",
    icon: Wallet,
  },
  {
    id: "review",
    label: "Review",
    description: "Confirm & submit",
    icon: ClipboardCheck,
  },
];

const TXN_TYPE_CARDS: Array<{
  id: QuickTxnType;
  label: string;
  description: string;
  disabled?: boolean;
  icon: typeof Zap;
}> = [
  {
    id: "one-time",
    label: "One time",
    description: "Lumpsum purchase for selected investors",
    icon: HandCoins,
  },
  {
    id: "sip",
    label: "SIP",
    description: "Start a systematic investment plan",
    icon: Repeat2,
  },
  {
    id: "redemption",
    label: "Redemption",
    description: "Coming soon",
    disabled: true,
    icon: Wallet,
  },
  {
    id: "switch",
    label: "Switch",
    description: "Coming soon",
    disabled: true,
    icon: ArrowLeftRight,
  },
];

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI" },
  { id: "netbanking", label: "Net banking" },
] as const;

/** Investor table shows four rows per page in the wizard */
const QUICK_TXN_INVESTOR_TABLE_PAGE_SIZE = 4;
/** Fund table shows four rows per page in the wizard */
const QUICK_TXN_FUND_TABLE_PAGE_SIZE = 4;

function parseFundAmount(value: string): number {
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stepIndex(step: WizardStepId): number {
  return WIZARD_STEPS.findIndex((item) => item.id === step);
}

function SchemeLogo({ scheme, compact }: { scheme: WizardFund; compact?: boolean }) {
  const sizeClass = compact ? "size-8" : "size-11";
  const logoUrl = resolveAmcLogoUrl(scheme.amcLogoUrl, scheme.amcSlug);

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(
          "shrink-0 rounded-[var(--radius-control)] border border-border bg-background object-contain p-0.5",
          sizeClass,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted font-semibold text-muted-foreground",
        compact ? "text-[10px]" : "text-micro",
        sizeClass,
      )}
      aria-hidden
    >
      {scheme.logoMark}
    </div>
  );
}

function SchemeName({ name, compact }: { name: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "min-w-0 font-medium leading-snug break-words whitespace-normal text-foreground",
        compact ? "line-clamp-2 text-compact" : "line-clamp-3 text-body",
      )}
      title={name}
    >
      {name}
    </span>
  );
}

export function QuickTransactionWizard() {
  const router = useRouter();
  const { submitForInvestorConfirmation } = useDistributorTxnRequests();
  const { addNotification } = useDistributorNotifications();
  const { showSkeleton: showPageSkeleton } = useQuickTransactionPageReveal();
  const { step, displayStep, goToStep, isSwitching, showPanelSkeleton } = useQuickTransactionStepSwitch();
  const [txnType, setTxnType] = useState<QuickTxnType>("one-time");
  const [investorSearch, setInvestorSearch] = useState("");
  const [selectedInvestorKeys, setSelectedInvestorKeys] = useState<Selection>(new Set());
  const [selectedSchemeKeys, setSelectedSchemeKeys] = useState<Selection>(new Set());
  const [selectedFundsById, setSelectedFundsById] = useState<Record<string, WizardFund>>({});
  const [fundAmounts, setFundAmounts] = useState<Record<string, string>>({});
  const [fundSearch, setFundSearch] = useState("");
  const [sipInstallments, setSipInstallments] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["id"] | "">("");
  const [investorPage, setInvestorPage] = useState(1);
  const [fundPage, setFundPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "clientCode",
    direction: "ascending",
  });
  const [fundSortDescriptor, setFundSortDescriptor] = useState<SortDescriptor>({
    column: "name",
    direction: "ascending",
  });
  const [bookInvestors, setBookInvestors] = useState<DistributorInvestor[] | null>(null);
  const [investorsLoadError, setInvestorsLoadError] = useState<string | null>(null);
  const [schemeResults, setSchemeResults] = useState<WizardFund[]>([]);
  const [schemesLoading, setSchemesLoading] = useState(false);
  const [schemesLoadError, setSchemesLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedSchemeIds = useMemo(() => {
    if (selectedSchemeKeys === "all") return [];
    return [...selectedSchemeKeys].map(String);
  }, [selectedSchemeKeys]);

  const selectedSchemes = useMemo(
    () => selectedSchemeIds.map((id) => selectedFundsById[id]).filter(Boolean) as WizardFund[],
    [selectedFundsById, selectedSchemeIds],
  );

  const handleSchemeSelectionChange = (keys: Selection) => {
    if (keys === "all") return;
    const ids = [...keys].map(String);
    if (ids.length > QUICK_TXN_MAX_FUNDS) {
      addNotification({
        title: "Fund limit reached",
        body: `You can add up to ${QUICK_TXN_MAX_FUNDS} funds per recommendation (same as the investor cart limit).`,
      });
    }
    const cappedIds = ids.slice(0, QUICK_TXN_MAX_FUNDS);
    setSelectedSchemeKeys(new Set(cappedIds));
    setSelectedFundsById((current) => {
      const next: Record<string, WizardFund> = {};
      for (const id of cappedIds) {
        const fund = current[id] ?? schemeResults.find((scheme) => scheme.id === id);
        if (fund) next[id] = fund;
      }
      return next;
    });
    setFundAmounts((current) => {
      const next: Record<string, string> = {};
      for (const id of cappedIds) {
        next[id] = current[id] ?? "";
      }
      return next;
    });
  };

  const removeSelectedFund = (fundId: string) => {
    const nextIds = selectedSchemeIds.filter((id) => id !== fundId);
    handleSchemeSelectionChange(new Set(nextIds));
    if (nextIds.length === 0 && displayStep === "amount") {
      goToStep("funds");
    }
  };

  useEffect(() => {
    if (displayStep !== "funds" && step !== "funds") return;
    let cancelled = false;
    setSchemesLoading(true);
    void searchDistributorSchemes({ q: fundSearch, page: 1, page_size: 40 })
      .then((response) => {
        if (!cancelled) {
          setSchemeResults(response.items.map((item) => mapApiSchemeToWizardFund(item, txnType)));
          setSchemesLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSchemeResults([]);
          setSchemesLoadError(
            error instanceof Error ? error.message : "Could not load funds.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSchemesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [displayStep, fundSearch, step, txnType]);

  const fundLines = useMemo(
    () =>
      selectedSchemeIds
        .map((id) => {
          const fund = selectedFundsById[id];
          if (!fund) return null;
          return {
            fund,
            amount: parseFundAmount(fundAmounts[id] ?? ""),
          };
        })
        .filter((line): line is { fund: WizardFund; amount: number } => line !== null),
    [fundAmounts, selectedFundsById, selectedSchemeIds],
  );

  const totalAmount = useMemo(
    () => fundLines.reduce((sum, line) => sum + line.amount, 0),
    [fundLines],
  );

  const totalAmountWords = useMemo(() => amountInWordsInr(totalAmount), [totalAmount]);

  const sipInstallmentCount = useMemo(() => {
    const parsed = Number.parseInt(sipInstallments.trim(), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [sipInstallments]);

  const sipInstallmentsValid = txnType !== "sip" || (sipInstallmentCount >= 1 && sipInstallmentCount <= 360);

  useEffect(() => {
    let cancelled = false;
    void fetchDistributorClients({ limit: 100, scope: "book" })
      .then((items) => {
        if (!cancelled) {
          setBookInvestors(filterDistributorBookInvestors(items));
          setInvestorsLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBookInvestors([]);
          setInvestorsLoadError(
            error instanceof Error ? error.message : "Could not load investors.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onboardedInvestors = useMemo(
    () => (bookInvestors ?? []).filter((investor) => investor.onboardingStatus === "Onboarded"),
    [bookInvestors],
  );

  const investorsFiltered = useMemo(() => {
    return searchInvestors(onboardedInvestors, investorSearch);
  }, [investorSearch, onboardedInvestors]);

  const investorsSorted = useMemo(
    () => sortByDescriptor(investorsFiltered, sortDescriptor),
    [investorsFiltered, sortDescriptor],
  );

  const { pageItems, totalPages, safePage } = useMemo(
    () => paginateTableItems(investorsSorted, investorPage, QUICK_TXN_INVESTOR_TABLE_PAGE_SIZE),
    [investorsSorted, investorPage],
  );

  const fundsFiltered = useMemo(
    () => filterWizardFunds(schemeResults, fundSearch),
    [fundSearch, schemeResults],
  );

  const fundsSorted = useMemo(
    () => sortByDescriptor(fundsFiltered, fundSortDescriptor),
    [fundsFiltered, fundSortDescriptor],
  );

  const {
    pageItems: fundPageItems,
    totalPages: fundTotalPages,
    safePage: fundSafePage,
  } = useMemo(
    () => paginateTableItems(fundsSorted, fundPage, QUICK_TXN_FUND_TABLE_PAGE_SIZE),
    [fundsSorted, fundPage],
  );

  const selectedInvestorIds = useMemo(() => {
    if (selectedInvestorKeys === "all") {
      return investorsFiltered.map((i) => i.id);
    }
    return [...selectedInvestorKeys].map(String);
  }, [selectedInvestorKeys, investorsFiltered]);

  const selectedInvestors = useMemo(
    () => (bookInvestors ?? []).filter((investor) => selectedInvestorIds.includes(investor.id)),
    [bookInvestors, selectedInvestorIds],
  );

  const isLoadingInvestors = bookInvestors === null;
  const investorEmptyTitle = investorsLoadError
    ? "Could not load investors"
    : investorSearch.trim()
      ? "No investors match your search"
      : "No onboarded investors yet";
  const investorEmptyDescription = investorsLoadError
    ? investorsLoadError
    : investorSearch.trim()
      ? "Try a different client code, email, PAN, or mobile number."
      : "Onboard a client in your book before starting a quick transaction.";
  const fundEmptyTitle = schemesLoadError
    ? "Could not load funds"
    : fundSearch.trim()
      ? "No funds match your search"
      : "No investable funds found";
  const fundEmptyDescription = schemesLoadError
    ? schemesLoadError
    : fundSearch.trim()
      ? "Try a different scheme name, IRN, AMC, or category."
      : "Fund search will populate schemes from the live catalog.";

  const allFundAmountsValid =
    fundLines.length > 0 &&
    fundLines.every(
      (line) => line.amount >= line.fund.minAmount && line.amount <= line.fund.maxAmount,
    );

  const canContinue = (() => {
    if (displayStep === "type") return txnType === "one-time" || txnType === "sip";
    if (displayStep === "investors") return selectedInvestorIds.length > 0;
    if (displayStep === "funds") return selectedSchemeIds.length > 0;
    if (displayStep === "amount") return allFundAmountsValid && paymentMethod.length > 0 && sipInstallmentsValid;
    return true;
  })();

  const goNext = () => {
    const idx = stepIndex(displayStep);
    if (idx < WIZARD_STEPS.length - 1) {
      goToStep(WIZARD_STEPS[idx + 1].id);
    }
  };

  const goBack = () => {
    const idx = stepIndex(displayStep);
    if (idx > 0) {
      goToStep(WIZARD_STEPS[idx - 1].id);
    }
  };

  const handleSubmit = async () => {
    const investor = selectedInvestors[0];
    if (!investor || fundLines.length === 0 || !paymentMethod) {
      return;
    }

    const paymentMethodLabel =
      PAYMENT_METHODS.find((method) => method.id === paymentMethod)?.label ?? paymentMethod;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const success = await submitForInvestorConfirmation({
        clientReference: distributorClientPathRef(investor),
        txnType: txnType === "sip" ? "sip" : "one-time",
        sipInstallments,
        clientCode: investor.clientCode,
        investorDisplayName: investor.displayName,
        profileImageUrl: investor.profileImageUrl,
        investorEmailMasked: investor.emailMasked,
        paymentMethod,
        paymentMethodLabel,
        items: fundLines.map((line) => ({
          productId: line.fund.id,
          amount: line.amount,
          fundName: line.fund.name,
          irn: line.fund.irn,
          amcLogoUrl: line.fund.amcLogoUrl,
          amcSlug: line.fund.amcSlug,
          logoMark: line.fund.logoMark,
        })),
      });

      addNotification({
        title: "Recommendation link sent",
        body: `${success.requestRef} was sent to ${investor.clientCode} with ${fundLines.length} fund${fundLines.length === 1 ? "" : "s"}.`,
      });

      router.push("/dashboard");
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "Could not send recommendation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useWizardKeyboardNavigation({
    onContinue: displayStep === "review" ? handleSubmit : goNext,
    onBack: goBack,
    canContinue: canContinue && !isSwitching && !isSubmitting,
    canBack: displayStep !== "type" && !isSwitching && !isSubmitting,
  });

  const currentStepIndex = stepIndex(displayStep);
  const journeyProgressPct = Math.round(((currentStepIndex + 1) / WIZARD_STEPS.length) * 100);

  if (showPageSkeleton) {
    return (
      <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
        <DistributorPageHeader title="Quick transaction" description="" />
        <QuickTransactionWizardSkeleton panelStep={displayStep} />
      </div>
    );
  }

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Quick transaction" description="" />

      <div
        className={cn(
          "quick-txn-wizard distributor-wizard-page--enter",
          isSwitching && "quick-txn-wizard--switching",
        )}
      >
        <nav
          className="quick-txn-wizard__journey"
          aria-label="Order journey"
          aria-busy={isSwitching}
        >
          <div className="quick-txn-journey-header">
            <div>
              <p className="quick-txn-journey-header__title">Order journey</p>
              <p className="quick-txn-journey-header__meta">
                Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
              </p>
            </div>
            <span className="quick-txn-journey-header__pct">{journeyProgressPct}%</span>
          </div>
          <div
            className="quick-txn-journey-progress"
            role="progressbar"
            aria-valuenow={journeyProgressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Order progress"
          >
            <div className="quick-txn-journey-progress__bar" style={{ width: `${journeyProgressPct}%` }} />
          </div>
          <ol className="quick-txn-journey-steps">
            {WIZARD_STEPS.map((item, index) => {
              const done = index < currentStepIndex;
              const active = item.id === displayStep;
              const upcoming = index > currentStepIndex;
              const StepIcon = item.icon;
              const navigable = index <= currentStepIndex;

              return (
                <li
                  key={item.id}
                  className={cn(
                    "quick-txn-journey-step",
                    active && "quick-txn-journey-step--active",
                    done && "quick-txn-journey-step--done",
                    upcoming && "quick-txn-journey-step--upcoming",
                  )}
                >
                  <div className="quick-txn-journey-step__rail" aria-hidden>
                    <span className="quick-txn-journey-step__marker">
                      {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                    </span>
                    {index < WIZARD_STEPS.length - 1 ? (
                      <span
                        className={cn(
                          "quick-txn-journey-step__line",
                          done && "quick-txn-journey-step__line--done",
                        )}
                      />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="quick-txn-journey-step__body"
                    disabled={!navigable}
                    aria-current={active ? "step" : undefined}
                    onClick={() => {
                      if (navigable) goToStep(item.id);
                    }}
                  >
                    <span className="quick-txn-journey-step__icon" aria-hidden>
                      <StepIcon className="size-4" strokeWidth={active ? 2.25 : 2} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="quick-txn-journey-step__label">{item.label}</span>
                      <span className="quick-txn-journey-step__desc">{item.description}</span>
                    </span>
                    {active ? (
                      <span className="quick-txn-journey-step__pill">Current</span>
                    ) : done ? (
                      <CheckCircle2 className="quick-txn-journey-step__done-icon size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="quick-txn-wizard__panel">
          {showPanelSkeleton ? (
            <QuickTransactionWizardSkeleton panelStep={displayStep} panelOnly />
          ) : (
            <div key={step} className="quick-txn-wizard__panel-layer">
          {step === "type" ? (
            <div className="quick-txn-wizard__section">
              <QuickTransactionSectionHeader
                title="Choose transaction type"
                helpText="One time and SIP are available in this demo flow."
                helpAriaLabel="Transaction type guidance"
              />
              <div className="quick-txn-type-grid">
                {TXN_TYPE_CARDS.map((card) => {
                  const Icon = card.icon;
                  const selected = txnType === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={card.disabled}
                      onClick={() => !card.disabled && setTxnType(card.id)}
                      className={cn(
                        "quick-txn-type-card",
                        selected && "quick-txn-type-card--selected",
                        card.disabled && "quick-txn-type-card--disabled",
                      )}
                    >
                      {selected ? (
                        <span className="quick-txn-type-card__check" aria-hidden>
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                      ) : null}
                      <span className="quick-txn-type-card__icon">
                        {card.disabled ? (
                          <Ban className="size-5 text-muted-foreground/60" strokeWidth={2} />
                        ) : (
                          <Icon className="size-5" strokeWidth={2.25} />
                        )}
                      </span>
                      <span className="quick-txn-type-card__label">{card.label}</span>
                      <span className="quick-txn-type-card__desc">{card.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === "investors" ? (
            <div className="quick-txn-wizard__section">
              <QuickTransactionSectionHeader
                title="Select investor"
                helpText="Search your onboarded book and select one investor."
                helpAriaLabel="Investor selection guidance"
                trailing={
                  <StatusBadge variant={selectedInvestors[0] ? "info" : "neutral"}>
                    {selectedInvestors[0]
                      ? selectedInvestors[0].clientCode
                        ? `1 investor selected · ${selectedInvestors[0].clientCode}`
                        : "1 investor selected"
                      : "No investor selected"}
                  </StatusBadge>
                }
              />
              <div className="quick-txn-investor-search">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={investorSearch}
                  onChange={(event) => {
                    setInvestorSearch(event.target.value);
                    setInvestorPage(1);
                  }}
                  placeholder="Search client code, email, PAN, mobile"
                  className="h-9 w-full pl-9"
                  aria-label="Search investors"
                />
              </div>
              <TableCard.Root size="md">
                {isLoadingInvestors ? (
                  <TableEmptyState
                    title="Loading investors…"
                    description="Fetching onboarded clients from your book."
                    icon={UserRound}
                  />
                ) : investorsSorted.length === 0 ? (
                  <TableEmptyState
                    title={investorEmptyTitle}
                    description={investorEmptyDescription}
                    icon={UserRound}
                  />
                ) : (
                  <Table
                    aria-label="Investors for quick transaction"
                    size="md"
                    className="min-w-[var(--table-min-width-3xl)]"
                    selectionMode="single"
                    selectionBehavior="replace"
                    selectedKeys={selectedInvestorKeys}
                    onSelectionChange={setSelectedInvestorKeys}
                    sortDescriptor={sortDescriptor}
                    onSortChange={(descriptor) => {
                      setSortDescriptor(descriptor);
                      setInvestorPage(1);
                    }}
                    pagination={{
                      page: safePage,
                      totalPages,
                      onPageChange: setInvestorPage,
                      alwaysVisible: true,
                    }}
                  >
                    <Table.Header size="md">
                      <Table.Head id="clientCode" label="Client" isRowHeader allowsSorting />
                      <Table.Head id="emailMasked" label="Email" allowsSorting />
                      <Table.Head id="investorType" label="Type" allowsSorting />
                      <Table.Head id="onboardingStatus" label="Onboarding" allowsSorting />
                      <Table.Head
                        id="createdAt"
                        label="Created"
                        allowsSorting
                        className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
                      />
                    </Table.Header>
                    <Table.Body items={pageItems}>
                      {(investor) => (
                        <Table.Row id={investor.id}>
                          <Table.Cell>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <DistributorProfileAvatar
                                name={investor.displayName || investor.clientCode}
                                imageSrc={investor.profileImageUrl}
                                size="sm"
                              />
                              <span className="min-w-0 truncate font-mono text-compact font-medium">
                                {investor.clientCode}
                              </span>
                            </div>
                          </Table.Cell>
                          <Table.Cell className="text-muted-foreground">
                            {investor.emailMasked}
                          </Table.Cell>
                          <Table.Cell className="text-compact">
                            {investor.investorType}
                          </Table.Cell>
                          <Table.Cell>
                            <StatusBadge variant={onboardingStatusVariant(investor.onboardingStatus)}>
                              {investor.onboardingStatus}
                            </StatusBadge>
                          </Table.Cell>
                          <Table.Cell
                            className={cn(
                              "text-compact text-muted-foreground",
                              DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
                            )}
                          >
                            {formatDistributorDate(investor.createdAt)}
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table>
                )}
              </TableCard.Root>
            </div>
          ) : null}

          {step === "funds" ? (
            <div className="quick-txn-wizard__section">
              <QuickTransactionSectionHeader
                title="Select funds"
                helpText={`Pick up to ${QUICK_TXN_MAX_FUNDS} schemes for this ${txnType === "sip" ? "SIP" : "lumpsum"} cart.`}
                helpAriaLabel="Fund selection guidance"
                trailing={
                  <StatusBadge variant={selectedSchemeIds.length > 0 ? "info" : "neutral"}>
                    {selectedSchemeIds.length > 0
                      ? `${selectedSchemeIds.length}/${QUICK_TXN_MAX_FUNDS} funds selected`
                      : "No funds selected"}
                  </StatusBadge>
                }
              />
              <div className="quick-txn-investor-search">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={fundSearch}
                  onChange={(event) => {
                    setFundSearch(event.target.value);
                    setFundPage(1);
                  }}
                  placeholder="Search scheme name, IRN, AMC, category"
                  className="h-10 w-full pl-9"
                  aria-label="Search funds"
                />
              </div>
              <TableCard.Root size="md">
                {schemesLoading ? (
                  <TableEmptyState
                    title="Loading funds…"
                    description="Searching investable schemes from the catalog."
                    icon={Layers3}
                  />
                ) : fundsSorted.length === 0 ? (
                  <TableEmptyState
                    title={fundEmptyTitle}
                    description={fundEmptyDescription}
                    icon={Layers3}
                  />
                ) : (
                <Table
                  aria-label="Funds for quick transaction"
                  size="md"
                  className="min-w-[var(--table-min-width-3xl)]"
                  selectionMode="multiple"
                  selectionBehavior="toggle"
                  selectedKeys={selectedSchemeKeys}
                  onSelectionChange={handleSchemeSelectionChange}
                  sortDescriptor={fundSortDescriptor}
                  onSortChange={(descriptor) => {
                    setFundSortDescriptor(descriptor);
                    setFundPage(1);
                  }}
                  pagination={{
                    page: fundSafePage,
                    totalPages: fundTotalPages,
                    onPageChange: setFundPage,
                    alwaysVisible: true,
                  }}
                >
                  <Table.Header size="md">
                    <Table.Head id="name" label="Scheme" isRowHeader allowsSorting />
                    <Table.Head id="amc" label="AMC" allowsSorting />
                    <Table.Head id="category" label="Category" allowsSorting />
                    <Table.Head id="irn" label="IRN" allowsSorting />
                    <Table.Head
                      id="minAmount"
                      label="Min"
                      allowsSorting
                      className="text-right [&>div]:justify-end"
                    />
                    <Table.Head
                      id="maxAmount"
                      label="Max"
                      allowsSorting
                      className="text-right [&>div]:justify-end"
                    />
                  </Table.Header>
                  <Table.Body items={fundPageItems}>
                    {(scheme) => (
                      <Table.Row id={scheme.id}>
                        <Table.Cell className="max-w-[16rem]">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <SchemeLogo scheme={scheme} compact />
                            <SchemeName name={scheme.name} compact />
                          </div>
                        </Table.Cell>
                        <Table.Cell className="max-w-[10rem] text-compact leading-snug break-words whitespace-normal text-muted-foreground">
                          {scheme.amc}
                        </Table.Cell>
                        <Table.Cell className="text-compact">
                          {scheme.category}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-micro text-muted-foreground">
                          {scheme.irn}
                        </Table.Cell>
                        <Table.Cell className="text-right text-compact tabular-nums">
                          {formatAum(scheme.minAmount)}
                        </Table.Cell>
                        <Table.Cell className="text-right text-compact tabular-nums">
                          {formatAum(scheme.maxAmount)}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>
                )}
              </TableCard.Root>
            </div>
          ) : null}

          {step === "amount" && selectedSchemes.length > 0 ? (
            <div className="quick-txn-wizard__section">
              <QuickTransactionSectionHeader
                title="Amounts & payment"
                helpText={
                  txnType === "sip"
                    ? "Enter installment amount for each fund, number of SIP installments, and payment method."
                    : "Enter the investment amount for each selected fund and choose payment method."
                }
                helpAriaLabel="Amount and payment guidance"
                trailing={
                  <StatusBadge variant="info">
                    {selectedSchemes.length} fund{selectedSchemes.length === 1 ? "" : "s"}
                  </StatusBadge>
                }
              />

              <form className="quick-txn-amount-form" onSubmit={(event) => event.preventDefault()}>
                <div className="quick-txn-amount-layout">
                  <aside className="quick-txn-amount-aside" aria-label="Total amount summary">
                    <div
                      className={cn(
                        "quick-txn-amount-words",
                        totalAmount <= 0 && "quick-txn-amount-words--empty",
                      )}
                    >
                      <div className="quick-txn-amount-words__header">
                        <span className="quick-txn-amount-words__icon" aria-hidden>
                          <IndianRupee className="size-4" strokeWidth={2.25} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="quick-txn-amount-words__label">Total amount</p>
                          <p className="quick-txn-amount-words__figure">
                            {totalAmount > 0 ? formatAum(totalAmount) : "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="quick-txn-amount-words__divider" aria-hidden />

                      <div className="quick-txn-amount-words__body">
                        <p className="quick-txn-amount-words__caption">Amount in words</p>
                        <p className="quick-txn-amount-words__value">
                          {totalAmount > 0 ? (
                            <>
                              <span className="quick-txn-amount-words__quote" aria-hidden>
                                “
                              </span>
                              {totalAmountWords}
                              <span className="quick-txn-amount-words__quote" aria-hidden>
                                ”
                              </span>
                            </>
                          ) : (
                            "N/A"
                          )}
                        </p>
                        {txnType === "sip" && totalAmount > 0 && sipInstallmentCount > 0 ? (
                          <p className="quick-txn-amount-words__meta">
                            {sipInstallmentCount} monthly installment{sipInstallmentCount === 1 ? "" : "s"} ·
                            Portfolio total {formatAum(totalAmount * sipInstallmentCount)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="quick-txn-amount-aside__divider" aria-hidden />

                    <Field className="quick-txn-amount-aside__payment">
                      <FieldLabel>Payment method</FieldLabel>
                      <div className="quick-txn-payment-methods">
                        {PAYMENT_METHODS.map((method) => (
                          <Button
                            key={method.id}
                            type="button"
                            variant={paymentMethod === method.id ? "default" : "outline"}
                            className="quick-txn-payment-method-btn"
                            onClick={() => setPaymentMethod(method.id)}
                          >
                            {method.id === "upi" ? (
                              <Image
                                src="/bhim.svg"
                                alt=""
                                width={20}
                                height={20}
                                className="size-5 shrink-0"
                                aria-hidden
                              />
                            ) : (
                              <Landmark className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                            )}
                            {method.label}
                          </Button>
                        ))}
                      </div>
                    </Field>
                  </aside>

                  <div className="quick-txn-amount-main">
                    <FieldGroup>
                      <div
                        className="quick-txn-amount-funds-scroll"
                        aria-label="Fund amounts"
                        tabIndex={0}
                      >
                        {fundLines.map((line) => (
                          <div
                            key={line.fund.id}
                            className="quick-txn-amount-fund-card rounded-[var(--radius-card)] border border-border bg-muted/15 p-3"
                          >
                            <div className="quick-txn-amount-fund-card__header">
                              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                                <SchemeLogo scheme={line.fund} compact />
                                <div className="min-w-0 flex-1">
                                  <SchemeName name={line.fund.name} compact />
                                  <p className="font-mono text-micro text-muted-foreground">
                                    IRN {line.fund.irn}
                                  </p>
                                  <p className="text-caption text-muted-foreground">
                                    Min {formatAum(line.fund.minAmount)} · Max {formatAum(line.fund.maxAmount)}
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="quick-txn-amount-fund-card__remove shrink-0 rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={`Remove ${line.fund.name}`}
                                onClick={() => removeSelectedFund(line.fund.id)}
                              >
                                <X className="size-4" strokeWidth={2.25} aria-hidden />
                              </Button>
                            </div>
                            <Field className="mt-3">
                              <FieldLabel htmlFor={`quick-txn-amount-${line.fund.id}`}>
                                {txnType === "sip" ? "Installment amount (INR)" : "Amount (INR)"}
                              </FieldLabel>
                              <Input
                                id={`quick-txn-amount-${line.fund.id}`}
                                inputMode="decimal"
                                placeholder="e.g. 5000"
                                value={fundAmounts[line.fund.id] ?? ""}
                                onChange={(event) =>
                                  setFundAmounts((current) => ({
                                    ...current,
                                    [line.fund.id]: event.target.value,
                                  }))
                                }
                              />
                              {line.amount > 0 &&
                              (line.amount < line.fund.minAmount || line.amount > line.fund.maxAmount) ? (
                                <p className="mt-1 text-caption text-destructive">
                                  Amount must be between {formatAum(line.fund.minAmount)} and{" "}
                                  {formatAum(line.fund.maxAmount)}.
                                </p>
                              ) : null}
                            </Field>
                          </div>
                        ))}
                      </div>

                  {txnType === "sip" ? (
                    <Field>
                      <FieldLabel htmlFor="quick-txn-sip-installments">SIP installments (all funds)</FieldLabel>
                      <Input
                        id="quick-txn-sip-installments"
                        inputMode="numeric"
                        placeholder="e.g. 12"
                        value={sipInstallments}
                        onChange={(event) => setSipInstallments(event.target.value.replace(/\D/g, ""))}
                      />
                      <p className="mt-1 text-caption text-muted-foreground">
                        Number of monthly installments (1–360) applied to each SIP line.
                      </p>
                      {sipInstallments.length > 0 && !sipInstallmentsValid ? (
                        <p className="mt-1 text-caption text-destructive">
                          Enter a valid installment count between 1 and 360.
                        </p>
                      ) : null}
                    </Field>
                      ) : null}
                    </FieldGroup>
                  </div>
                </div>
              </form>
            </div>
          ) : null}

          {step === "review" ? (
            <div className="quick-txn-wizard__section">
              <QuickTransactionSectionHeader
                title="Review"
                helpText="Confirm details before sending the recommendation link."
                helpAriaLabel="Review step guidance"
                trailing={<StatusBadge variant="success">Ready to submit</StatusBadge>}
              />

              <div className="quick-txn-review">
                <div className="quick-txn-review-hero">
                  <div className="quick-txn-review-hero__top">
                    <p className="quick-txn-review-hero__label">
                      {txnType === "sip" ? "Total SIP per month" : "Total investment"}
                    </p>
                    <p className="quick-txn-review-hero__amount">
                      {totalAmount > 0 ? formatAum(totalAmount) : "—"}
                    </p>
                    <p className="quick-txn-review-hero__words">
                      {totalAmount > 0 ? (
                        <>
                          <span className="quick-txn-review-hero__words-quote" aria-hidden>
                            “
                          </span>
                          {totalAmountWords}
                          <span className="quick-txn-review-hero__words-quote" aria-hidden>
                            ”
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </p>
                    {txnType === "sip" && sipInstallmentCount > 0 ? (
                      <p className="quick-txn-review-hero__sip-meta">
                        {sipInstallmentCount} monthly installment{sipInstallmentCount === 1 ? "" : "s"} per fund ·
                        Portfolio total {formatAum(totalAmount * sipInstallmentCount)}
                      </p>
                    ) : null}
                  </div>
                  <div className="quick-txn-review-hero__payment">
                    {paymentMethod === "upi" ? (
                      <Image
                        src="/bhim.svg"
                        alt=""
                        width={18}
                        height={18}
                        className="size-[1.125rem] shrink-0"
                        aria-hidden
                      />
                    ) : paymentMethod === "netbanking" ? (
                      <Landmark className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    ) : null}
                    <span>{PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label ?? "—"}</span>
                  </div>
                </div>

                <div className="quick-txn-review-grid">
                  <div className="quick-txn-review-card">
                    <span className="quick-txn-review-card__icon" aria-hidden>
                      {txnType === "sip" ? (
                        <Repeat2 className="size-4" strokeWidth={2.25} />
                      ) : (
                        <HandCoins className="size-4" strokeWidth={2.25} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="quick-txn-review-card__label">Transaction type</p>
                      <p className="quick-txn-review-card__value">{txnType === "sip" ? "SIP" : "One time"}</p>
                      {txnType === "sip" && sipInstallmentCount > 0 ? (
                        <p className="quick-txn-review-card__hint">
                          {sipInstallmentCount} installments × {formatAum(totalAmount)} / month across{" "}
                          {fundLines.length} fund{fundLines.length === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="quick-txn-review-card">
                    <DistributorProfileAvatar
                      name={
                        selectedInvestors[0]?.displayName ||
                        selectedInvestors[0]?.clientCode ||
                        "Investor"
                      }
                      imageSrc={selectedInvestors[0]?.profileImageUrl}
                      size="sm"
                      className="quick-txn-review-card__avatar shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="quick-txn-review-card__label">Investor</p>
                      <p className="quick-txn-review-card__value font-mono">
                        {selectedInvestors[0]?.clientCode ?? "—"}
                      </p>
                      <p className="quick-txn-review-card__hint">{selectedInvestors[0]?.emailMasked ?? ""}</p>
                    </div>
                  </div>
                </div>

                <div className="quick-txn-review-funds">
                  <p className="quick-txn-review-card__label">
                    Selected funds ({fundLines.length}/{QUICK_TXN_MAX_FUNDS})
                  </p>
                  <div
                    className="quick-txn-review-funds-scroll"
                    aria-label="Selected funds"
                    tabIndex={0}
                  >
                    {fundLines.map((line) => (
                      <div key={line.fund.id} className="quick-txn-review-fund">
                        <SchemeLogo scheme={line.fund} compact />
                        <div className="min-w-0 flex-1">
                          <SchemeName name={line.fund.name} compact />
                          <div className="quick-txn-review-fund__meta">
                            <span className="font-mono">{line.fund.irn}</span>
                            <span aria-hidden>·</span>
                            <span>{formatAum(line.amount)}</span>
                            {txnType === "sip" && sipInstallmentCount > 0 ? (
                              <>
                                <span aria-hidden>·</span>
                                <span>{sipInstallmentCount} installments</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {submitError ? (
                  <p className="mt-4 rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 px-3 py-2 text-compact text-destructive">
                    {submitError}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
            </div>
          )}

          <div className="quick-txn-wizard__footer">
            <DistributorActionButton
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={displayStep === "type" || isSwitching || isSubmitting}
            >
              Back
            </DistributorActionButton>
            {displayStep === "review" ? (
              <DistributorActionButton
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canContinue || isSwitching || isSubmitting}
              >
                {isSubmitting ? "Sending…" : "Send recommendation"}
              </DistributorActionButton>
            ) : (
              <DistributorActionButton type="button" onClick={goNext} disabled={!canContinue || isSwitching || isSubmitting}>
                Continue
              </DistributorActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
