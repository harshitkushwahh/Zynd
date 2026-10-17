"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { SupportMetricsTilesSkeleton, SupportTableSkeleton } from "@/components/dashboard/support-table-skeleton";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { YourClientsBookMetrics } from "@/components/workspace/your-clients-book-metrics";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
  DISTRIBUTOR_PAGE_STACK_CLASS,
} from "@/lib/distributor-layout";
import { isSupportUserDirectoryUnavailable } from "@/lib/distributor-client-errors";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDate } from "@/lib/format";
import type { DistributorInvestor } from "@/lib/distributor-types";
import {
  complianceStatusVariant,
  investmentStatusVariant,
  onboardingStatusVariant,
} from "@/lib/status-meta";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import {
  listSupportDirectoryInvestorsPage,
  supportUserDetailHref,
} from "@/lib/support-users-api";
import { SUPPORT_USERS_LIST_PAGE_SIZE } from "@/lib/support-users-pagination";
import { cn } from "@/lib/utils";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SupportUsersBookPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [investors, setInvestors] = useState<DistributorInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [apiOffset, setApiOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  useEffect(() => {
    setApiOffset(0);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");

    void listSupportDirectoryInvestorsPage({
      search: debouncedSearch || undefined,
      limit: SUPPORT_USERS_LIST_PAGE_SIZE,
      offset: apiOffset,
    })
      .then((page) => {
        if (cancelled) return;
        setInvestors(page.items);
        setHasMore(page.hasMore);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setInvestors([]);
        setHasMore(false);
        if (isSupportUserDirectoryUnavailable(error)) {
          setLoadError(
            "User directory API is unavailable. Restart Backend (Backend/run.sh) and reload this page.",
          );
          return;
        }
        setLoadError("Could not load users. Try again in a moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, apiOffset]);

  const reload = useCallback(() => {
    setLoadingMore(true);
    setLoadError("");
    void listSupportDirectoryInvestorsPage({
      search: debouncedSearch || undefined,
      limit: SUPPORT_USERS_LIST_PAGE_SIZE,
      offset: apiOffset,
    })
      .then((page) => {
        setInvestors(page.items);
        setHasMore(page.hasMore);
      })
      .catch(() => setLoadError("Could not load users. Try again in a moment."))
      .finally(() => setLoadingMore(false));
  }, [apiOffset, debouncedSearch]);

  const rows = useMemo(
    () => sortByDescriptor(investors, sortDescriptor),
    [investors, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(rows, {
    initialPageSize: 25,
  });

  const openUser = (investor: DistributorInvestor) => {
    router.push(supportUserDetailHref(investor.clientCode));
  };

  const serverPage = Math.floor(apiOffset / SUPPORT_USERS_LIST_PAGE_SIZE) + 1;

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Users" />

      {loading ? (
        <SupportMetricsTilesSkeleton />
      ) : (
        <YourClientsBookMetrics listScope="all" investors={investors} />
      )}

      <DistributorTableOnlyShell
        isLoading={loading}
        loadingSkeleton={<SupportTableSkeleton rowCount={10} columnCount={5} />}
        isEmpty={!loading && rows.length === 0}
        emptyTitle={loadError || "No users match your search"}
        emptyDescription={
          loadError
            ? undefined
            : debouncedSearch
              ? "Try a different email or Zynd ID."
              : "No investor accounts are registered yet."
        }
        toolbar={
          <DistributorTableSearchCard
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search by email or Zynd ID…"
          />
        }
      >
        {wrapDistributorTableBody(
          <Table
            aria-label="Support users"
            className="min-w-[var(--table-min-width-5xl)]"
            sortDescriptor={sortDescriptor}
            onSortChange={(descriptor) => {
              setSortDescriptor(descriptor);
              setPage(1);
            }}
            pagination={pagination}
          >
            <Table.Header>
              <Table.Head id="displayName" label="User" isRowHeader allowsSorting />
              <Table.Head
                id="clientCode"
                label="Zynd ID"
                allowsSorting
                className={DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS}
              />
              <Table.Head id="onboardingStatus" label="Onboarding" allowsSorting />
              <Table.Head id="complianceStatus" label="KYC" allowsSorting />
              <Table.Head id="investmentStatus" label="Invested" allowsSorting />
              <Table.Head
                id="createdAt"
                label="Joined"
                allowsSorting
                className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
              />
            </Table.Header>
            <Table.Body items={pageItems}>
              {(investor) => (
                <Table.Row
                  id={investor.id}
                  className="cursor-pointer"
                  onAction={() => openUser(investor)}
                >
                  <Table.Cell>
                    <div className="min-w-0">
                      <p className="truncate text-compact font-medium text-foreground">
                        {investor.displayName}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">{investor.emailMasked}</p>
                    </div>
                  </Table.Cell>
                  <Table.Cell className={cn("font-mono text-caption", DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS)}>
                    {investor.clientCode}
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge variant={onboardingStatusVariant(investor.onboardingStatus)}>
                      {investor.onboardingStatus}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge variant={complianceStatusVariant(investor.complianceStatus)}>
                      {investor.complianceStatus}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge variant={investmentStatusVariant(investor.investmentStatus)}>
                      {investor.investmentStatus}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}>
                    {formatDistributorDate(investor.createdAt)}
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>,
        )}
      </DistributorTableOnlyShell>

      {loadError ? (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" disabled={loadingMore} onClick={reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !loadError && (hasMore || apiOffset > 0) ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={apiOffset === 0 || loadingMore}
            onClick={() => setApiOffset((value) => Math.max(0, value - SUPPORT_USERS_LIST_PAGE_SIZE))}
          >
            Previous {SUPPORT_USERS_LIST_PAGE_SIZE}
          </Button>
          <span className="text-caption text-muted-foreground tabular-nums">Page {serverPage}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasMore || loadingMore}
            onClick={() => setApiOffset((value) => value + SUPPORT_USERS_LIST_PAGE_SIZE)}
          >
            Next {SUPPORT_USERS_LIST_PAGE_SIZE}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
