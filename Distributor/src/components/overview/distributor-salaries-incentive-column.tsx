"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { DistributorProfileAvatar } from "@/components/ui/distributor-profile-avatar";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import type { DistributorTxnRequest, TxnRequestStatus } from "@/lib/distributor-types";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const RECENT_TXN_LIMIT = 5;

function formatTxnAmount(request: DistributorTxnRequest): string {
  if (request.amount == null) return request.requestType;
  return formatAum(request.amount).replace(/\.00$/, "");
}

function TxnRequestStatusBadge({ status }: { status: TxnRequestStatus }) {
  return (
    <span
      className={cn(
        "distributor-salaries-incentive__txn-status",
        `distributor-salaries-incentive__txn-status--${status.toLowerCase()}`,
      )}
    >
      {status}
    </span>
  );
}

function RecentTxnRow({ request }: { request: DistributorTxnRequest }) {
  return (
    <Link
      href="/dashboard/txn-requests"
      className="distributor-salaries-incentive__row distributor-salaries-incentive__row--link"
    >
      <DistributorProfileAvatar name={request.clientCode} size="sm" />
      <span className="distributor-salaries-incentive__row-copy">
        <span className="distributor-salaries-incentive__row-name">{request.requestRef}</span>
        <span className="distributor-salaries-incentive__row-meta">
          {request.requestType} · {formatTxnAmount(request)} · {formatDistributorDate(request.createdAt)}
        </span>
      </span>
      <TxnRequestStatusBadge status={request.status} />
    </Link>
  );
}

export type DistributorSalariesIncentiveColumnProps = {
  className?: string;
};

function TxnSidebarHeader({ count }: { count: number }) {
  return (
    <div className="distributor-salaries-incentive__header-main">
      <div className="distributor-salaries-incentive__header-copy">
        <p className="distributor-salaries-incentive__eyebrow">Sent by you</p>
        <h2 className="distributor-salaries-incentive__title">Txn requests</h2>
      </div>
      <span className="distributor-salaries-incentive__header-count tabular-nums" aria-label={`${count} txn requests`}>
        {count}
      </span>
    </div>
  );
}

export function DistributorSalariesIncentiveColumn({ className }: DistributorSalariesIncentiveColumnProps) {
  const { requests: txnRequests } = useDistributorTxnRequests();

  const recentTxnRequests = useMemo(
    () =>
      [...txnRequests]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, RECENT_TXN_LIMIT),
    [txnRequests],
  );

  const txnRequestStats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const request of txnRequests) {
      if (request.status === "Pending") pending += 1;
      else if (request.status === "Approved") approved += 1;
      else if (request.status === "Rejected") rejected += 1;
    }
    return {
      pending,
      approved,
      rejected,
    };
  }, [txnRequests]);

  return (
    <div className={cn("distributor-salaries-incentive-column", className)}>
      <aside className="distributor-salaries-incentive" aria-label="Txn requests">
        <header className="distributor-salaries-incentive__header">
          <TxnSidebarHeader count={txnRequests.length} />
        </header>

        <div className="distributor-salaries-incentive__list-block">
          <div className="distributor-salaries-incentive__list">
            {recentTxnRequests.length === 0 ? (
              <p className="distributor-salaries-incentive__list-empty">No txn requests yet.</p>
            ) : (
              recentTxnRequests.map((request) => <RecentTxnRow key={request.id} request={request} />)
            )}
          </div>
        </div>

        <div className="distributor-salaries-incentive__summary distributor-salaries-incentive__txn-card">
          <p className="distributor-salaries-incentive__txn-stats-label">By status</p>
          <div className="distributor-salaries-incentive__txn-stats" role="list">
            <div className="distributor-salaries-incentive__txn-stat" role="listitem">
              <span className="distributor-salaries-incentive__txn-stat-label">Pending</span>
              <span className="distributor-salaries-incentive__txn-stat-value tabular-nums">
                {txnRequestStats.pending}
              </span>
            </div>
            <div className="distributor-salaries-incentive__txn-stat" role="listitem">
              <span className="distributor-salaries-incentive__txn-stat-label">Approved</span>
              <span className="distributor-salaries-incentive__txn-stat-value tabular-nums">
                {txnRequestStats.approved}
              </span>
            </div>
            <div className="distributor-salaries-incentive__txn-stat" role="listitem">
              <span className="distributor-salaries-incentive__txn-stat-label">Rejected</span>
              <span className="distributor-salaries-incentive__txn-stat-value tabular-nums">
                {txnRequestStats.rejected}
              </span>
            </div>
          </div>

          <Link href="/dashboard/txn-requests" className="distributor-salaries-incentive__txn-cta">
            <span className="distributor-salaries-incentive__txn-cta-label">View all txn requests</span>
            <ChevronRight className="distributor-salaries-incentive__txn-cta-icon" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>
      </aside>
    </div>
  );
}
