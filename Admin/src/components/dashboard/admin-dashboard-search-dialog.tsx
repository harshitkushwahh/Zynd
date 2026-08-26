"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, Search } from "lucide-react";

import {
  AdminDialog,
  AdminDialogContent,
} from "@/components/ui/admin-dialog";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { referralReferrerDetailHref } from "@/lib/admin-referrals-navigation";
import {
  getVisibleAdminRoutes,
  type AdminNavRoute,
} from "@/lib/admin-navigation";
import { searchAdmin, type AdminSearchGroup, type AdminSearchScope } from "@/lib/admin-search-api";
import { userDashboardProfileHref } from "@/lib/admin-user-ref";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { cn } from "@/lib/utils";

type AdminDashboardSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type SearchRecord = {
  id: string;
  label: string;
  description?: string;
  href: string;
};

function scopesForPermissions(hasPermission: (key: string) => boolean): AdminSearchScope[] {
  const scopes: AdminSearchScope[] = [];
  if (hasPermission("users.read")) scopes.push("users");
  if (hasPermission("referrals.read")) {
    scopes.push(
      "referrals.referrers",
      "referrals.attributions",
      "referrals.redemptions",
      "referrals.reward_rules",
      "referrals.leaderboard",
    );
  }
  return scopes;
}

function recordFromSearchItem(scope: string, item: Record<string, unknown>): SearchRecord | null {
  if (scope === "users") {
    const clientId = String(item.client_id ?? "");
    if (!clientId) return null;
    return {
      id: `users:${clientId}`,
      label: String(item.display_name ?? clientId),
      description: String(item.email ?? clientId),
      href: userDashboardProfileHref(clientId),
    };
  }

  if (scope === "referrals.referrers") {
    const user = (item.user ?? {}) as Record<string, unknown>;
    const clientId = String(user.client_id ?? "");
    if (!clientId) return null;
    const code = item.referral_code ? ` · ${item.referral_code}` : "";
    return {
      id: `referrers:${clientId}`,
      label: String(item.display_name ?? user.display_name ?? clientId),
      description: `${user.email ?? clientId}${code}`,
      href: referralReferrerDetailHref(clientId),
    };
  }

  if (scope === "referrals.attributions") {
    const referrer = (item.referrer ?? {}) as Record<string, unknown>;
    const referee = (item.referee ?? {}) as Record<string, unknown>;
    const refereeId = String(referee.client_id ?? "");
    if (!refereeId) return null;
    return {
      id: `attributions:${item.id ?? refereeId}`,
      label: String(referee.display_name ?? refereeId),
      description: referrer.display_name
        ? `Referred by ${referrer.display_name}`
        : String(referee.email ?? refereeId),
      href: userDashboardProfileHref(refereeId, "referrals"),
    };
  }

  if (scope === "referrals.redemptions") {
    const referrer = (item.referrer ?? {}) as Record<string, unknown>;
    const clientId = String(referrer.client_id ?? "");
    if (!clientId) return null;
    return {
      id: `redemptions:${item.id ?? clientId}`,
      label: String(referrer.display_name ?? clientId),
      description: `${item.rule_name ?? "Reward"} · ${item.status ?? "pending"}`,
      href: referralReferrerDetailHref(clientId),
    };
  }

  if (scope === "referrals.reward_rules") {
    const id = String(item.id ?? item.name ?? "");
    if (!id) return null;
    return {
      id: `reward_rules:${id}`,
      label: String(item.name ?? "Reward rule"),
      description: item.description ? String(item.description) : String(item.trigger ?? ""),
      href: "/dashboard/referrals/rewards",
    };
  }

  if (scope === "referrals.leaderboard") {
    const user = (item.user ?? {}) as Record<string, unknown>;
    const clientId = String(user.client_id ?? "");
    if (!clientId) return null;
    return {
      id: `leaderboard:${clientId}`,
      label: String(item.display_name ?? user.display_name ?? clientId),
      description: `${item.referral_count ?? 0} referrals · ${item.referral_code ?? clientId}`,
      href: referralReferrerDetailHref(clientId),
    };
  }

  return null;
}

function groupsToRecords(groups: AdminSearchGroup[] | null | undefined): SearchRecord[] {
  if (!groups?.length) return [];
  const records: SearchRecord[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      const record = recordFromSearchItem(group.scope, item as Record<string, unknown>);
      if (record) records.push(record);
    }
  }
  return records;
}

export function AdminDashboardSearchDialog({
  open,
  onOpenChange,
}: AdminDashboardSearchDialogProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const [query, setQuery] = useState("");
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const requestIdRef = useRef(0);
  const routes = useMemo(() => getVisibleAdminRoutes(hasPermission), [hasPermission]);
  const searchScopes = useMemo(() => scopesForPermissions(hasPermission), [hasPermission]);

  const filteredRoutes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return routes;
    return routes.filter(
      (route) =>
        route.label.toLowerCase().includes(normalized) ||
        route.description?.toLowerCase().includes(normalized) ||
        route.href.toLowerCase().includes(normalized),
    );
  }, [query, routes]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRecords([]);
      setRecordsLoading(false);
    }
  }, [open]);

  useEffect(() => {
    const normalized = query.trim();
    if (!open || normalized.length < 2 || searchScopes.length === 0) {
      setRecords([]);
      setRecordsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setRecordsLoading(true);
    const timer = window.setTimeout(() => {
      void searchAdmin({
        scopes: searchScopes,
        q: normalized,
        limit: 20,
      })
        .then((result) => {
          if (requestId !== requestIdRef.current) return;
          setRecords(groupsToRecords(result.groups));
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setRecords([]);
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setRecordsLoading(false);
          }
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [open, query, searchScopes]);

  const navigateHref = (href: string, external?: boolean) => {
    onOpenChange(false);
    if (external) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  };

  const navigateRoute = (route: AdminNavRoute) => {
    navigateHref(route.href, route.external);
  };

  const showRecords = query.trim().length >= 2 && searchScopes.length > 0;
  const hasResults = filteredRoutes.length > 0 || records.length > 0;

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent size="md" align="top" className="gap-0 p-0">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
          <AdminSearchInput
            bare
            showIcon={false}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, users, referrals..."
            containerClassName="min-w-0 flex-1"
          />
          {recordsLoading ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </div>
        <div className="max-h-scroll-md overflow-y-auto p-2">
          {!hasResults && !recordsLoading ? (
            <p className="px-3 py-6 text-center text-compact text-muted-foreground">
              {query.trim().length >= 2
                ? "No pages or records match your search."
                : "No pages match your search."}
            </p>
          ) : (
            <>
              {filteredRoutes.length > 0 ? (
                <section className="mb-2">
                  <p className="px-3 py-1.5 text-caption font-medium uppercase tracking-wide text-muted-foreground">
                    Pages
                  </p>
                  {filteredRoutes.map((route) => {
                    const Icon = route.icon;
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => navigateRoute(route)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-muted",
                        )}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-compact font-medium text-foreground">
                            {route.label}
                          </span>
                          {route.description ? (
                            <span className="block text-caption text-muted-foreground">
                              {route.description}
                            </span>
                          ) : null}
                        </span>
                        {route.showTrailingArrow ? (
                          <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        ) : null}
                      </button>
                    );
                  })}
                </section>
              ) : null}

              {showRecords && records.length > 0 ? (
                <section>
                  <p className="px-3 py-1.5 text-caption font-medium uppercase tracking-wide text-muted-foreground">
                    Records
                  </p>
                  {records.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => navigateHref(record.href)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-muted",
                      )}
                    >
                      <Search className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-compact font-medium text-foreground">
                          {record.label}
                        </span>
                        {record.description ? (
                          <span className="block text-caption text-muted-foreground">
                            {record.description}
                          </span>
                        ) : null}
                      </span>
                      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </section>
              ) : null}

              {showRecords && recordsLoading && records.length === 0 ? (
                <p className="px-3 py-4 text-center text-compact text-muted-foreground">
                  Searching records...
                </p>
              ) : null}
            </>
          )}
        </div>
      </AdminDialogContent>
    </AdminDialog>
  );
}
