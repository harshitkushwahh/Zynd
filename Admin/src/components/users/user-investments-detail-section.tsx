"use client";

import { ShoppingCart, TrendingUp, Wallet } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminUserInvestmentsDetail } from "@/lib/admin-api";
import { orderStatusVariant } from "@/components/users/user-status-badge";
import { PROFILE_SECTION_TITLE_CLASS } from "@/components/users/user-profile-typography";

function formatInr(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "—";
  return new Date(value).toLocaleDateString();
}

function SectionShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-muted/20 p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-[var(--radius-control)] bg-background p-2 text-primary ring-1 ring-border">
          <Icon className="size-4" />
        </div>
        <div>
          <h3 className={PROFILE_SECTION_TITLE_CLASS}>{title}</h3>
          <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

export function UserInvestmentsDetailSection({
  investments,
}: {
  investments: AdminUserInvestmentsDetail;
}) {
  const cartItems = investments.cart.items ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-border bg-background px-4 py-3">
          <p className="text-caption text-muted-foreground">Cart items</p>
          <p className="mt-1 text-h4 font-semibold text-foreground">{investments.cart.item_count}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-border bg-background px-4 py-3">
          <p className="text-caption text-muted-foreground">Cart total</p>
          <p className="mt-1 text-h4 font-semibold text-foreground">
            {formatInr(investments.cart.total_amount_inr)}
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-border bg-background px-4 py-3">
          <p className="text-caption text-muted-foreground">Holdings</p>
          <p className="mt-1 text-h4 font-semibold text-foreground">{investments.holdings.length}</p>
        </div>
      </div>

      <SectionShell
        title="Cart"
        description="Funds currently saved in this user's cart."
        icon={ShoppingCart}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-table-lg text-left text-compact">
            <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Fund</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">SIP day</th>
                <th className="px-4 py-3 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.length === 0 ? (
                <EmptyRow colSpan={5} message="Cart is empty." />
              ) : (
                cartItems.map((item) => (
                  <tr key={`${String(item.product_id)}-${String(item.investment_type)}`} className="border-b border-border">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {String(item.product_name ?? item.product_id ?? "—")}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {String(item.investment_type ?? "—")}
                    </td>
                    <td className="px-4 py-3">{formatInr(item.amount_inr)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.installment_day ? String(item.installment_day) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <SectionShell
        title="Purchased funds"
        description="Completed mutual fund purchases for this user."
        icon={TrendingUp}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-table-lg text-left text-compact">
            <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Fund</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Settled</th>
              </tr>
            </thead>
            <tbody>
              {investments.purchases.length === 0 ? (
                <EmptyRow colSpan={4} message="No completed purchases yet." />
              ) : (
                investments.purchases.map((order) => (
                  <tr key={String(order.order_id)} className="border-b border-border">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {String(order.product_name ?? order.product_id ?? "—")}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {String(order.order_type ?? "—")}
                    </td>
                    <td className="px-4 py-3">{formatInr(order.amount_inr)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(order.settled_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <SectionShell
        title="All transactions"
        description="Recent mutual fund orders including pending and failed attempts."
        icon={Wallet}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-table-2xl text-left text-compact">
            <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Fund</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Failure</th>
              </tr>
            </thead>
            <tbody>
              {investments.orders.length === 0 ? (
                <EmptyRow colSpan={6} message="No transactions found." />
              ) : (
                investments.orders.map((order) => (
                  <tr key={String(order.order_id)} className="border-b border-border">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {String(order.product_name ?? order.product_id ?? "—")}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {String(order.order_type ?? "—")}
                    </td>
                    <td className="px-4 py-3">{formatInr(order.amount_inr)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={orderStatusVariant(String(order.status ?? ""))}>
                        {String(order.status ?? "—")}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {order.failure_reason ? String(order.failure_reason) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <SectionShell
        title="Holdings"
        description="Imported portfolio holdings for this user."
        icon={TrendingUp}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-table-2xl text-left text-compact">
            <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Scheme</th>
                <th className="px-4 py-3 font-medium">Folio</th>
                <th className="px-4 py-3 font-medium">Units</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">As of</th>
              </tr>
            </thead>
            <tbody>
              {investments.holdings.length === 0 ? (
                <EmptyRow colSpan={5} message="No holdings imported yet." />
              ) : (
                investments.holdings.map((holding) => (
                  <tr
                    key={`${String(holding.isin)}-${String(holding.folio_number)}`}
                    className="border-b border-border"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {String(holding.scheme_name ?? holding.matched_scheme_name ?? "—")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {String(holding.folio_number ?? "—")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{String(holding.units ?? "—")}</td>
                    <td className="px-4 py-3">{formatInr(holding.market_value_inr)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(holding.as_of_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <SectionShell
        title="SIP plans"
        description="Active and historical SIP plans for this user."
        icon={Wallet}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-table-2xl text-left text-compact">
            <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Fund</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Frequency</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Next installment</th>
              </tr>
            </thead>
            <tbody>
              {investments.sip_plans.length === 0 ? (
                <EmptyRow colSpan={5} message="No SIP plans found." />
              ) : (
                investments.sip_plans.map((plan) => (
                  <tr key={String(plan.plan_id)} className="border-b border-border">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {String(plan.product_name ?? plan.product_id ?? "—")}
                    </td>
                    <td className="px-4 py-3">{formatInr(plan.amount_inr)}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {String(plan.frequency ?? "—")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={orderStatusVariant(String(plan.status ?? ""))}>
                        {String(plan.status ?? "—")}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(plan.next_installment_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>
    </div>
  );
}
