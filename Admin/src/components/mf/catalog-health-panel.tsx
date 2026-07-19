"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  AlertTriangle,
  Ban,
  Clock3,
  Info,
  LineChart,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { MfStatusChip, type MfStatusTone } from "@/components/mf/mf-status-chip";
import { AdminInfoDialog } from "@/components/ui/admin-dialog-presets";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfCatalogHealth,
  fetchMfCatalogHealthIssues,
  type MfCatalogHealthIssue,
  type MfCatalogHealthSummary,
} from "@/lib/mf-admin-api";

const ALL_CHECKS = "all";

function HealthGatesInfoDialog({
  open,
  onClose,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  summary: MfCatalogHealthSummary;
}) {
  const { config, generated_at } = summary;

  return (
    <AdminInfoDialog
      open={open}
      onClose={onClose}
      title="Catalog health gates"
      description="Rules that block funds from going public when NAV data is stale or incomplete."
      icon={ShieldAlert}
      iconTone="info"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <StatusBadge variant={config.gates_enabled ? "success" : "neutral"} showIcon={false}>
            Gates {config.gates_enabled ? "enabled" : "disabled"}
          </StatusBadge>
        </div>
        <dl className="space-y-3 text-compact">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Stale NAV threshold</dt>
            <dd className="font-medium text-foreground">&gt; {config.nav_stale_days} days</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Minimum NAV rows</dt>
            <dd className="font-medium text-foreground">{config.min_nav_rows.toLocaleString()}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Last updated</dt>
            <dd className="font-medium text-foreground">{new Date(generated_at).toLocaleString()}</dd>
          </div>
        </dl>
        {!config.gates_enabled ? (
          <p className="rounded-control border border-border bg-muted/20 px-3 py-2 text-caption text-muted-foreground">
            Gates are off in this environment, so health issues are reported but funds are not blocked
            from public visibility.
          </p>
        ) : null}
      </div>
    </AdminInfoDialog>
  );
}


function flagTone(flag: string): MfStatusTone {
  if (flag === "stale_nav" || flag === "orphan_product") return "danger";
  return "warning";
}

export function CatalogHealthPanel({
  onOpenFund,
}: {
  onOpenFund?: (fundId: number) => void;
}) {
  const [summary, setSummary] = useState<MfCatalogHealthSummary | null>(null);
  const [issues, setIssues] = useState<MfCatalogHealthIssue[]>([]);
  const [activeCheck, setActiveCheck] = useState<string | null>(null);
  const [issuePage, setIssuePage] = useState(1);
  const [issueTotal, setIssueTotal] = useState(0);
  const [issueHasMore, setIssueHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gatesInfoOpen, setGatesInfoOpen] = useState(false);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [health, issueResult] = await Promise.all([
        fetchMfCatalogHealth(),
        fetchMfCatalogHealthIssues(activeCheck ?? undefined, issuePage, ADMIN_TABLE_PAGE_SIZE),
      ]);
      setSummary(health);
      setIssues(issueResult.items);
      setIssueTotal(issueResult.total);
      setIssueHasMore(issueResult.has_more);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load catalog health."));
    } finally {
      setLoading(false);
    }
  }, [activeCheck, issuePage]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    setIssuePage(1);
  }, [activeCheck]);

  const healthMetrics = useMemo(
    () => [
      {
        key: "public-blocked",
        label: "Public blocked",
        value: (summary?.summary.public_blocked_by_health ?? 0).toLocaleString(),
        icon: Ban,
        tone: "warning" as const,
      },
      {
        key: "stale-nav",
        label: "Stale NAV",
        value: (summary?.summary.stale_nav ?? 0).toLocaleString(),
        icon: Clock3,
        tone: "warning" as const,
      },
      {
        key: "shallow-history",
        label: "Shallow history",
        value: (summary?.summary.shallow_nav_history ?? 0).toLocaleString(),
        icon: LineChart,
        tone: "muted" as const,
      },
      {
        key: "missing-3y",
        label: "Missing 3Y",
        value: (summary?.summary.missing_3y_metrics ?? 0).toLocaleString(),
        icon: AlertTriangle,
        tone: "info" as const,
      },
    ],
    [summary],
  );

  const issueTotalPages = Math.max(1, Math.ceil(issueTotal / ADMIN_TABLE_PAGE_SIZE));
  const activeCheckLabel =
    activeCheck == null
      ? "All issues"
      : (summary?.checks.find((check) => check.key === activeCheck)?.label ?? activeCheck);

  return (
    <section className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {healthMetrics.map((metric) => (
          <AdminMetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            tone={metric.tone}
            loading={loading}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSectionTitle icon={ShieldAlert}>Health issues</AdminSectionTitle>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select
            value={activeCheck ?? ALL_CHECKS}
            onValueChange={(value) => setActiveCheck(value === ALL_CHECKS ? null : (value ?? null))}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All issues">{activeCheckLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CHECKS}>All issues</SelectItem>
              {(summary?.checks ?? []).map((check) => (
                <SelectItem key={check.key} value={check.key}>
                  {check.label} ({check.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            disabled={!summary}
            onClick={() => setGatesInfoOpen(true)}
            aria-label="View catalog health gate settings"
          >
            <Info className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={loading}
            onClick={() => void loadHealth()}
            aria-label="Refresh health issues"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {summary ? (
        <HealthGatesInfoDialog
          open={gatesInfoOpen}
          onClose={() => setGatesInfoOpen(false)}
          summary={summary}
        />
      ) : null}

      <AdminDataTable minWidth="xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Scheme / AMC</AdminTableHeadCell>
            <AdminTableHeadCell>Flags</AdminTableHeadCell>
            <AdminTableHeadCell>Latest NAV</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Rows</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={4} />
          ) : issues.length === 0 ? (
            <AdminTableStateRow colSpan={4}>No issues for this filter.</AdminTableStateRow>
          ) : (
            issues.map((issue, index) => (
              <AdminTableRow
                key={`${issue.fund_id ?? "amc"}-${issue.product_id ?? issue.amc_id ?? index}`}
                onClick={
                  issue.fund_id && onOpenFund ? () => onOpenFund(issue.fund_id!) : undefined
                }
              >
                <AdminTableCell>
                  <p className="font-medium text-foreground">
                    {issue.scheme_name ?? issue.amc_name ?? "—"}
                  </p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {issue.amc_name ?? "AMC issue"}
                  </p>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-wrap gap-1">
                    {issue.health_flags.map((flag, flagIndex) => (
                      <MfStatusChip
                        key={`${flag}-${flagIndex}`}
                        label={flag.replaceAll("_", " ")}
                        tone={flagTone(flag)}
                        showIcon={false}
                      />
                    ))}
                  </div>
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {issue.latest_nav_date
                    ? new Date(issue.latest_nav_date).toLocaleDateString()
                    : "—"}
                </AdminTableCell>
                <AdminTableCell className="text-right">{issue.nav_row_count ?? "—"}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      {!loading && issues.length > 0 ? (
        <AdminTablePagination
          page={issuePage - 1}
          totalPages={issueTotalPages}
          hasPrevious={issuePage > 1}
          hasNext={issueHasMore}
          disabled={loading}
          onPrevious={() => setIssuePage((page) => Math.max(1, page - 1))}
          onNext={() => setIssuePage((page) => page + 1)}
        />
      ) : null}
    </section>
  );
}
