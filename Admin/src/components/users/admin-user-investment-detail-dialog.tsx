"use client";

import { Landmark, TrendingUp } from "lucide-react";

import { AmcLogo } from "@/components/mf/amc-logo";
import { AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { KycField, KycFieldGrid } from "@/components/users/admin-user-kyc-panel-shared";

type InvestmentRecord = Record<string, unknown>;

type AdminUserInvestmentDetailDialogProps = {
  open: boolean;
  purchase?: InvestmentRecord | null;
  holding?: InvestmentRecord | null;
  relatedPurchases?: InvestmentRecord[];
  onClose: () => void;
};

function formatInr(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatInrExact(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatUnits(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(amount)) {
    return amount.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  }
  if (value == null || value === "") return null;
  return String(value);
}

function formatPct(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toFixed(2)}%`;
}

function stringOrNull(value: unknown) {
  if (value == null || value === "") return null;
  return String(value);
}

function titleCase(value: unknown) {
  const text = stringOrNull(value);
  if (!text) return null;
  return text.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function returnTone(value: unknown): "success" | "warning" | "muted" {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount === 0) return "muted";
  return amount > 0 ? "success" : "warning";
}

function purchaseStatusLabel(order: InvestmentRecord) {
  const status = String(order.status ?? "").trim().toUpperCase();
  if (status === "SUCCEEDED") return "Succeeded";
  if (!status) return "Completed";
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function purchaseStatusVariant(order: InvestmentRecord): StatusBadgeVariant {
  const status = String(order.status ?? "").trim().toUpperCase();
  if (status === "SUCCEEDED") return "success";
  return "info";
}

function fundName(purchase?: InvestmentRecord | null, holding?: InvestmentRecord | null) {
  return (
    stringOrNull(holding?.scheme_name) ??
    stringOrNull(holding?.matched_scheme_name) ??
    stringOrNull(purchase?.product_name) ??
    "Fund detail"
  );
}

function PurchaseFacts({ purchase }: { purchase: InvestmentRecord }) {
  return (
    <article className="admin-user-investment-detail__block">
      <div className="admin-user-investment-detail__block-head">
        <TrendingUp className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span>Purchase</span>
        <StatusBadge variant={purchaseStatusVariant(purchase)} className="ml-auto">
          {purchaseStatusLabel(purchase)}
        </StatusBadge>
      </div>
      <AdminMetricCardsGrid columns="two" className="admin-user-investment-detail__metrics">
        <AdminMetricCard
          variant="secondary"
          icon={TrendingUp}
          label="Amount"
          value={formatInr(purchase.amount_inr) ?? "—"}
          hint={titleCase(purchase.order_type) ?? "Order"}
        />
        <AdminMetricCard
          variant="secondary"
          icon={TrendingUp}
          label="Settled"
          value={formatDate(purchase.settled_at) ?? "—"}
          hint={formatDate(purchase.created_at) ? `Created ${formatDate(purchase.created_at)}` : "Completed order"}
        />
      </AdminMetricCardsGrid>
      <KycFieldGrid>
        <KycField label="Order ID" value={stringOrNull(purchase.order_id)} />
        <KycField label="Purchase reference" value={stringOrNull(purchase.fp_purchase_id)} />
        <KycField label="Product ID" value={stringOrNull(purchase.product_id)} />
        <KycField label="Payment method" value={titleCase(purchase.payment_method)} />
        <KycField label="Provider state" value={titleCase(purchase.fp_state)} />
      </KycFieldGrid>
    </article>
  );
}

function HoldingFacts({ holding }: { holding: InvestmentRecord }) {
  const returnLabel = [formatInr(holding.return_inr), formatPct(holding.return_pct)]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="admin-user-investment-detail__block">
      <div className="admin-user-investment-detail__block-head">
        <Landmark className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span>Holding</span>
        {holding.folio_number ? (
          <span className="admin-user-investment-detail__folio">
            Folio {String(holding.folio_number)}
          </span>
        ) : null}
      </div>
      <AdminMetricCardsGrid columns="two" className="admin-user-investment-detail__metrics">
        <AdminMetricCard
          variant="secondary"
          icon={Landmark}
          label="Current value"
          value={formatInr(holding.market_value_inr) ?? "—"}
          hint={formatDate(holding.as_of_date) ? `As of ${formatDate(holding.as_of_date)}` : "Live holding"}
        />
        <AdminMetricCard
          variant="secondary"
          icon={TrendingUp}
          label="Invested"
          value={formatInr(holding.invested_inr) ?? "—"}
          hint="Cost of units"
        />
        <AdminMetricCard
          variant="secondary"
          icon={TrendingUp}
          tone={returnTone(holding.return_inr ?? holding.return_pct)}
          label="Returns"
          value={returnLabel || "—"}
          hint={holding.allocation_pct != null ? `${Number(holding.allocation_pct).toFixed(1)}% of portfolio` : "Unrealised"}
        />
        <AdminMetricCard
          variant="secondary"
          icon={Landmark}
          label="Units"
          value={formatUnits(holding.units) ?? "—"}
          hint={
            holding.redeemable_units != null
              ? `${formatUnits(holding.redeemable_units)} redeemable`
              : "Allocated units"
          }
        />
      </AdminMetricCardsGrid>
      <KycFieldGrid>
        <KycField label="ISIN" value={stringOrNull(holding.isin)} />
        <KycField label="NAV" value={formatInrExact(holding.nav_value)} />
        <KycField label="Redeemable value" value={formatInr(holding.redeemable_amount_inr)} />
        <KycField label="Source" value={titleCase(holding.source)} />
      </KycFieldGrid>
    </article>
  );
}

export function AdminUserInvestmentDetailDialog({
  open,
  purchase,
  holding,
  relatedPurchases = [],
  onClose,
}: AdminUserInvestmentDetailDialogProps) {
  if (!open || (!purchase && !holding)) return null;

  const name = fundName(purchase, holding);
  const amcName = stringOrNull(holding?.amc_name) ?? stringOrNull(purchase?.amc_name);
  const amcLogoUrl = stringOrNull(holding?.amc_logo_url) ?? stringOrNull(purchase?.amc_logo_url);
  const extraPurchases = relatedPurchases.filter(
    (item) => stringOrNull(item.order_id) !== stringOrNull(purchase?.order_id),
  );
  const purchasesToShow = purchase ? [purchase, ...extraPurchases] : relatedPurchases;

  return (
    <AdminDetailDialog
      open={open}
      onClose={onClose}
      title={name}
      description={amcName ? `${amcName} · Purchase and holding` : "Purchase and holding"}
      icon={holding ? Landmark : TrendingUp}
      iconTone={holding ? "success" : "info"}
      size="wide"
      headerClassName="admin-user-investment-detail-dialog__header"
    >
      <div className="admin-user-investment-detail space-y-4">
        <div className="admin-user-investment-detail__fund">
          <AmcLogo name={amcName ?? name} logoUrl={amcLogoUrl} size="md" fallback="icon" />
          <div className="min-w-0">
            <p className="font-medium text-pretty break-words text-foreground">{name}</p>
            {amcName ? (
              <p className="mt-0.5 text-caption text-pretty text-muted-foreground">{amcName}</p>
            ) : null}
          </div>
        </div>

        {holding ? (
          <HoldingFacts holding={holding} />
        ) : (
          <p className="admin-user-investment-detail__empty">
            No matching holding yet. Units appear here after allotment.
          </p>
        )}

        {purchasesToShow.length > 0 ? (
          <div className="space-y-3">
            {purchasesToShow.map((item) => (
              <PurchaseFacts key={stringOrNull(item.order_id) ?? stringOrNull(item.product_id) ?? name} purchase={item} />
            ))}
          </div>
        ) : (
          <p className="admin-user-investment-detail__empty">
            No completed purchase on file for this scheme.
          </p>
        )}
      </div>
    </AdminDetailDialog>
  );
}

export function normalizeFundName(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function fundsMatch(left: unknown, right: unknown) {
  const first = normalizeFundName(left);
  const second = normalizeFundName(right);
  if (!first || !second) return false;
  return first === second || first.includes(second) || second.includes(first);
}

export function matchHoldingForPurchase(purchase: InvestmentRecord, holdings: InvestmentRecord[]) {
  return (
    holdings.find(
      (holding) =>
        fundsMatch(purchase.product_name, holding.scheme_name) ||
        fundsMatch(purchase.product_name, holding.matched_scheme_name),
    ) ?? null
  );
}

export function matchPurchasesForHolding(holding: InvestmentRecord, purchases: InvestmentRecord[]) {
  return purchases.filter(
    (purchase) =>
      fundsMatch(purchase.product_name, holding.scheme_name) ||
      fundsMatch(purchase.product_name, holding.matched_scheme_name),
  );
}
