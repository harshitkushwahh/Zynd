"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useWizardKeyboardNavigation } from "@/hooks/use-wizard-keyboard-navigation";
import {
  ArrowLeftRight,
  Ban,
  Check,
  CheckCircle2,
  ClipboardCheck,
  HandCoins,
  Landmark,
  Layers3,
  Repeat2,
  Search,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Selection, SortDescriptor } from "react-aria-components";

import { paginateTableItems, Table, TableCard } from "@/components/application/table";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { QuickTransactionSectionHeader } from "@/components/quick-transaction/quick-transaction-section-header";
import { QuickTransactionWizardSkeleton } from "@/components/quick-transaction/quick-transaction-wizard-skeleton";
import type { QuickTransactionWizardStepId } from "@/components/quick-transaction/quick-transaction-wizard-types";
import { useQuickTransactionPageReveal } from "@/components/quick-transaction/use-quick-transaction-page-reveal";
import { useQuickTransactionStepSwitch } from "@/components/quick-transaction/use-quick-transaction-step-switch";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { amountInWordsInr } from "@/lib/amount-in-words";
import { useDistributorNotifications } from "@/contexts/distributor-notifications-context";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import { DUMMY_INVESTORS, searchInvestors } from "@/lib/distributor-investor-utils";
import { DUMMY_SCHEMES, getDistributorSchemeById, searchSchemes, type DistributorScheme } from "@/lib/distributor-schemes-data";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
} from "@/lib/distributor-layout";
import { formatAum, formatDistributorDate } from "@/lib/format";
import type { QuickTxnType } from "@/lib/quick-transaction-types";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { onboardingStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

type WizardStepId = QuickTransactionWizardStepId;

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
    label: "Select fund",
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

function stepIndex(step: WizardStepId): number {
  return WIZARD_STEPS.findIndex((item) => item.id === step);
}

function SchemeLogo({ scheme, compact }: { scheme: DistributorScheme; compact?: boolean }) {
  return (
    <div
      className={cn("quick-txn-scheme-logo", compact && "quick-txn-scheme-logo--compact")}
      aria-hidden
    >
      <Image src="/logo.png" alt="" width={40} height={40} className="size-full object-contain" />
      <span className="quick-txn-scheme-logo__mark">{scheme.logoMark}</span>
    </div>
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
  const [fundSearch, setFundSearch] = useState("");
  const [amount, setAmount] = useState("");
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

  const selectedSchemeId = useMemo(() => {
    if (selectedSchemeKeys === "all") return null;
    const id = [...selectedSchemeKeys][0];
    return id != null ? String(id) : null;
  }, [selectedSchemeKeys]);

  const selectedScheme = selectedSchemeId ? getDistributorSchemeById(selectedSchemeId) : undefined;

  const amountNumber = useMemo(() => {
    const parsed = Number.parseFloat(amount.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amount]);

  const amountWords = useMemo(() => amountInWordsInr(amountNumber), [amountNumber]);

  const sipInstallmentCount = useMemo(() => {
    const parsed = Number.parseInt(sipInstallments.trim(), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [sipInstallments]);

  const sipInstallmentsValid = txnType !== "sip" || (sipInstallmentCount >= 1 && sipInstallmentCount <= 360);

  const investorsFiltered = useMemo(() => {
    const onboarded = DUMMY_INVESTORS.filter((i) => i.onboardingStatus === "Onboarded");
    return searchInvestors(onboarded, investorSearch);
  }, [investorSearch]);

  const investorsSorted = useMemo(
    () => sortByDescriptor(investorsFiltered, sortDescriptor),
    [investorsFiltered, sortDescriptor],
  );

  const { pageItems, totalPages, safePage } = useMemo(
    () => paginateTableItems(investorsSorted, investorPage, QUICK_TXN_INVESTOR_TABLE_PAGE_SIZE),
    [investorsSorted, investorPage],
  );

  const fundsFiltered = useMemo(
    () => searchSchemes(DUMMY_SCHEMES, fundSearch),
    [fundSearch],
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
    () => DUMMY_INVESTORS.filter((i) => selectedInvestorIds.includes(i.id)),
    [selectedInvestorIds],
  );

  const amountValid =
    selectedScheme &&
    amountNumber >= selectedScheme.minAmount &&
    amountNumber <= selectedScheme.maxAmount;

  const canContinue = (() => {
    if (displayStep === "type") return txnType === "one-time" || txnType === "sip";
    if (displayStep === "investors") return selectedInvestorIds.length > 0;
    if (displayStep === "funds") return Boolean(selectedSchemeId);
    if (displayStep === "amount") return amountValid && paymentMethod.length > 0 && sipInstallmentsValid;
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

  const handleSubmit = () => {
    const investor = selectedInvestors[0];
    const scheme = selectedScheme;
    if (!investor || !scheme || !paymentMethod) {
      return;
    }

    const paymentMethodLabel =
      PAYMENT_METHODS.find((method) => method.id === paymentMethod)?.label ?? paymentMethod;

    const success = submitForInvestorConfirmation({
      txnType: txnType === "sip" ? "sip" : "one-time",
      amount: amountNumber,
      sipInstallments,
      clientCode: investor.clientCode,
      investorEmailMasked: investor.emailMasked,
      fundName: scheme.name,
      irn: scheme.irn,
      paymentMethodLabel,
    });

    addNotification({
      title: "Investor confirmation sent",
      body: `${success.requestRef} is pending approval from ${investor.clientCode} (${formatAum(amountNumber)} ${txnType === "sip" ? "SIP" : "purchase"}).`,
    });

    router.push("/dashboard");
  };

  useWizardKeyboardNavigation({
    onContinue: displayStep === "review" ? handleSubmit : goNext,
    onBack: goBack,
    canContinue: canContinue && !isSwitching,
    canBack: displayStep !== "type" && !isSwitching,
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
                        <Table.Cell className="font-mono text-compact font-medium">
                          {investor.clientCode}
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
                          className={cn("text-compact text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}
                        >
                          {formatDistributorDate(investor.createdAt)}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>
              </TableCard.Root>
            </div>
          ) : null}

          {step === "funds" ? (
            <div className="quick-txn-wizard__section">
              <QuickTransactionSectionHeader
                title="Select fund"
                helpText={`Pick a scheme for this ${txnType === "sip" ? "SIP" : "lumpsum"}.`}
                helpAriaLabel="Fund selection guidance"
                trailing={
                  <StatusBadge variant={selectedScheme ? "info" : "neutral"}>
                    {selectedScheme
                      ? selectedScheme.irn
                        ? `1 fund selected · ${selectedScheme.irn}`
                        : "1 fund selected"
                      : "No fund selected"}
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
                <Table
                  aria-label="Funds for quick transaction"
                  size="md"
                  className="min-w-[var(--table-min-width-3xl)]"
                  selectionMode="single"
                  selectionBehavior="replace"
                  selectedKeys={selectedSchemeKeys}
                  onSelectionChange={setSelectedSchemeKeys}
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
                        <Table.Cell>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <SchemeLogo scheme={scheme} compact />
                            <span className="min-w-0 truncate text-compact font-medium">{scheme.name}</span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-compact text-muted-foreground">
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
              </TableCard.Root>
            </div>
          ) : null}

          {step === "amount" && selectedScheme ? (
            <div className="quick-txn-wizard__section">
              <QuickTransactionSectionHeader
                title="Amount & payment"
                helpText={
                  txnType === "sip"
                    ? "Enter installment amount, number of SIP installments, and payment method."
                    : "Enter the transaction amount and payment method."
                }
                helpAriaLabel="Amount and payment guidance"
              />

              <div className="quick-txn-scheme-summary quick-txn-scheme-summary--compact">
                <SchemeLogo scheme={selectedScheme} compact />
                <div className="min-w-0 flex-1">
                  <p className="text-compact font-semibold">{selectedScheme.name}</p>
                  <p className="font-mono text-micro text-muted-foreground">IRN {selectedScheme.irn}</p>
                  <p className="text-caption text-muted-foreground">
                    Min {formatAum(selectedScheme.minAmount)} · Max {formatAum(selectedScheme.maxAmount)}
                  </p>
                </div>
              </div>

              <form className="quick-txn-amount-form" onSubmit={(event) => event.preventDefault()}>
                <FieldGroup>
                  <div className="quick-txn-amount-words">
                    <p className="quick-txn-amount-words__label">Amount in words</p>
                    <p className="quick-txn-amount-words__value">
                      {amountNumber > 0 ? amountWords : "N/A"}
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="quick-txn-amount">
                      {txnType === "sip" ? "Installment amount (INR)" : "Amount (INR)"}
                    </FieldLabel>
                    <Input
                      id="quick-txn-amount"
                      inputMode="decimal"
                      placeholder="e.g. 5000"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                    {amountNumber > 0 && !amountValid ? (
                      <p className="mt-1 text-caption text-destructive">
                        Amount must be between {formatAum(selectedScheme.minAmount)} and{" "}
                        {formatAum(selectedScheme.maxAmount)}.
                      </p>
                    ) : null}
                  </Field>
                  {txnType === "sip" ? (
                    <Field>
                      <FieldLabel htmlFor="quick-txn-sip-installments">SIP installments</FieldLabel>
                      <Input
                        id="quick-txn-sip-installments"
                        inputMode="numeric"
                        placeholder="e.g. 12"
                        value={sipInstallments}
                        onChange={(event) => setSipInstallments(event.target.value.replace(/\D/g, ""))}
                      />
                      <p className="mt-1 text-caption text-muted-foreground">
                        Number of monthly installments (1–360).
                      </p>
                      {sipInstallments.length > 0 && !sipInstallmentsValid ? (
                        <p className="mt-1 text-caption text-destructive">
                          Enter a valid installment count between 1 and 360.
                        </p>
                      ) : null}
                    </Field>
                  ) : null}
                  <Field>
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
                </FieldGroup>
              </form>
            </div>
          ) : null}

          {step === "review" ? (
            <div className="quick-txn-wizard__section">
              <QuickTransactionSectionHeader
                title="Review"
                helpText="Confirm details before submitting (demo only)."
                helpAriaLabel="Review step guidance"
                trailing={<StatusBadge variant="success">Ready to submit</StatusBadge>}
              />

              <div className="quick-txn-review">
                <div className="quick-txn-review-hero">
                  <div className="quick-txn-review-hero__top">
                    <p className="quick-txn-review-hero__label">
                      {txnType === "sip" ? "SIP installment amount" : "Investment amount"}
                    </p>
                    <p className="quick-txn-review-hero__amount">
                      {amountNumber > 0 ? formatAum(amountNumber) : "—"}
                    </p>
                    <p className="quick-txn-review-hero__words">
                      {amountNumber > 0 ? amountWords : "N/A"}
                    </p>
                    {txnType === "sip" && sipInstallmentCount > 0 ? (
                      <p className="quick-txn-review-hero__sip-meta">
                        {sipInstallmentCount} monthly installment{sipInstallmentCount === 1 ? "" : "s"} · Total{" "}
                        {formatAum(amountNumber * sipInstallmentCount)}
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
                          {sipInstallmentCount} installments × {formatAum(amountNumber)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="quick-txn-review-card">
                    <span className="quick-txn-review-card__icon" aria-hidden>
                      <UserRound className="size-4" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0">
                      <p className="quick-txn-review-card__label">Investor</p>
                      <p className="quick-txn-review-card__value font-mono">
                        {selectedInvestors[0]?.clientCode ?? "—"}
                      </p>
                      <p className="quick-txn-review-card__hint">{selectedInvestors[0]?.emailMasked ?? ""}</p>
                    </div>
                  </div>
                </div>

                {selectedScheme ? (
                  <div className="quick-txn-review-fund">
                    <SchemeLogo scheme={selectedScheme} compact />
                    <div className="min-w-0 flex-1">
                      <p className="quick-txn-review-card__label">Selected fund</p>
                      <p className="quick-txn-review-fund__name">{selectedScheme.name}</p>
                      <div className="quick-txn-review-fund__meta">
                        <span className="font-mono">{selectedScheme.irn}</span>
                        <span aria-hidden>·</span>
                        <span>{selectedScheme.category}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {formatAum(selectedScheme.minAmount)} – {formatAum(selectedScheme.maxAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
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
              disabled={displayStep === "type" || isSwitching}
            >
              Back
            </DistributorActionButton>
            {displayStep === "review" ? (
              <DistributorActionButton type="button" onClick={handleSubmit} disabled={!canContinue || isSwitching}>
                Submit transaction
              </DistributorActionButton>
            ) : (
              <DistributorActionButton type="button" onClick={goNext} disabled={!canContinue || isSwitching}>
                Continue
              </DistributorActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
