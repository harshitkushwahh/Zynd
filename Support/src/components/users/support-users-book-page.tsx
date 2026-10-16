"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
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
import { searchInvestors } from "@/lib/distributor-investor-utils";
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
import {
  SUPPORT_USERS_LIST_MAX_ROWS,
  SUPPORT_USERS_LIST_PAGE_SIZE,
} from "@/lib/support-users-pagination";
import { cn } from "@/lib/utils";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

async function fetchAllSupportDirectoryInvestors(search: string): Promise<DistributorInvestor[]> {
  const collected: DistributorInvestor[] = [];
  let offset = 0;

  while (collected.length < SUPPORT_USERS_LIST_MAX_ROWS) {
    const page = await listSupportDirectoryInvestorsPage({
      search: search || undefined,
      limit: SUPPORT_USERS_LIST_PAGE_SIZE,
      offset,
    });
    collected.push(...page.items);
    if (!page.hasMore || page.items.length === 0) {
      break;
    }
    offset = page.nextOffset;
  }

  return collected;
}

export function SupportUsersBookPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [investors, setInvestors] = useState<DistributorInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setInvestors([]);
    setHasMore(false);

    void fetchAllSupportDirectoryInvestors(debouncedSearch)
      .then((items) => {
        if (!cancelled) {
          setInvestors(items);
          setHasMore(items.length >= SUPPORT_USERS_LIST_MAX_ROWS);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setInvestors([]);
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
  }, [debouncedSearch]);

  const reload = useCallback(() => {
    setLoadingMore(true);
    setLoadError("");
    void fetchAllSupportDirectoryInvestors(debouncedSearch)
      .then(setInvestors)
      .catch(() => setLoadError("Could not load users. Try again in a moment."))
      .finally(() => setLoadingMore(false));
  }, [debouncedSearch]);

  const rows = useMemo(() => {
    const filtered = debouncedSearch ? searchInvestors(investors, search) : investors;
    return sortByDescriptor(filtered, sortDescriptor);
  }, [investors, debouncedSearch, search, sortDescriptor]);

  const { pageItems, pagination, setPage } = useDistributorTablePagination(rows);

  const openUser = (investor: DistributorInvestor) => {
    router.push(supportUserDetailHref(investor.clientCode));
  };

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Users" />

      <YourClientsBookMetrics listScope="all" investors={investors} />

      <DistributorTableOnlyShell
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
            onChange={setSearch}
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
            <Table.Body items={loading ? [] : pageItems}>
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

      {hasMore && !loadError ? (
        <p className="text-center text-caption text-muted-foreground">
          Showing the first {SUPPORT_USERS_LIST_MAX_ROWS} users. Refine search to find others.
        </p>
      ) : null}
    </div>
  );
}
