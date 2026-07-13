"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  GitBranch,
  Upload,
  HeartPulse,
  Layers,
  LineChart,
  RefreshCw,
  Search,
  Settings2,
  TrendingUp,
  X,
} from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { BulkImportPanel } from "@/components/mf/bulk-import-panel";
import { CatalogRulesPanel } from "@/components/mf/catalog-rules-panel";
import { AmcContentDrawer } from "@/components/mf/amc-content-drawer";
import { CatalogHealthPanel } from "@/components/mf/catalog-health-panel";
import { CategoryCurationPanel } from "@/components/mf/category-curation-panel";
import { ComplianceSettingsPanel } from "@/components/mf/compliance-settings-panel";
import { SchemeStagingPanel } from "@/components/mf/scheme-staging-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfAmcs,
  fetchMfCategories,
  fetchMfFundDetail,
  fetchMfFundNavs,
  fetchMfFunds,
  fetchMfIngestionRuns,
  fetchMfJobs,
  fetchMfOverview,
  runMfJob,
  updateMfAmc,
  updateMfFund,
  type MfAmc,
  type MfCategoryAdmin,
  type MfFundAdmin,
  type MfFundAdminDetail,
  type MfFundNavHistory,
  type MfIngestionRun,
  type MfJob,
} from "@/lib/mf-admin-api";

type TabKey = "overview" | "health" | "staging" | "categories" | "funds" | "amcs" | "content" | "rules" | "bulk" | "operations";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNav(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toFixed(4);
}

function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "warning"
        ? "border-warning/30 bg-warning/10 text-warning"
        : tone === "danger"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-muted text-foreground";
  return (
    <span
      className={`inline-flex rounded-[var(--radius-control)] border px-2 py-0.5 text-caption ${toneClass}`}
    >
      {label}
    </span>
  );
}

function lifecycleTone(status: string | null): "success" | "warning" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "INACTIVE") return "warning";
  return "neutral";
}

function NavSparkline({ points }: { points: MfFundNavHistory["points"] }) {
  const values = points.map((point) => point.nav).filter((value): value is number => value != null);
  if (values.length < 2) {
    return <p className="text-caption text-muted-foreground">Not enough NAV data.</p>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 280;
  const height = 72;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full max-w-sm text-primary">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ReasonModal({
  title,
  description,
  confirmLabel,
  loading,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Reason (required)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loading || !reason.trim()}
              onClick={() => onConfirm(reason.trim())}
            >
              {loading ? "Saving..." : confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FundDetailDrawer({
  fundId,
  canManage,
  canManageContent,
  onClose,
  onUpdated,
}: {
  fundId: number;
  canManage: boolean;
  canManageContent: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<MfFundAdminDetail | null>(null);
  const [navHistory, setNavHistory] = useState<MfFundNavHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visibility, setVisibility] = useState("AUTO");
  const [investability, setInvestability] = useState("AUTO");
  const [disableReason, setDisableReason] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [fundDetail, navs] = await Promise.all([
        fetchMfFundDetail(fundId),
        fetchMfFundNavs(fundId, 90),
      ]);
      setDetail(fundDetail);
      setNavHistory(navs);
      setVisibility(fundDetail.admin_visibility ?? "AUTO");
      setInvestability(fundDetail.admin_investability ?? "AUTO");
    } catch (err) {
      setError(getErrorMessage(err, "Could not load fund detail."));
    } finally {
      setLoading(false);
    }
  }, [fundId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSaveOverrides = async () => {
    if (!canManage || !detail) return;
    const needsReason =
      visibility === "FORCE_HIDE" ||
      investability === "BLOCK_ORDERS" ||
      detail.fund_active === false;
    if (needsReason && !disableReason.trim()) {
      setError("Provide a reason for hide/block actions.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateMfFund(fundId, {
        admin_visibility: visibility as "AUTO" | "FORCE_SHOW" | "FORCE_HIDE",
        admin_investability: investability as "AUTO" | "BLOCK_ORDERS",
        reason: disableReason.trim() || undefined,
      });
      setDetail(updated);
      onUpdated();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save catalog overrides."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <button type="button" className="flex-1" aria-label="Close fund drawer" onClick={onClose} />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-zynd-high">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-caption text-muted-foreground">Fund detail</p>
            <h2 className="font-heading text-h4 font-semibold text-foreground">
              {detail?.scheme_name ?? "Loading..."}
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="size-3.5" />
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <p className="text-compact text-muted-foreground">Loading fund...</p>
          ) : error ? (
            <p className="text-compact text-destructive">{error}</p>
          ) : detail ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={detail.lifecycle_status ?? "UNKNOWN"} tone={lifecycleTone(detail.lifecycle_status)} />
                <StatusBadge
                  label={detail.amc_empanelled ? "AMC empanelled" : "AMC not empanelled"}
                  tone={detail.amc_empanelled ? "success" : "warning"}
                />
                <StatusBadge
                  label={detail.fp_oms_purchase_allowed ? "Purchasable" : "Not purchasable"}
                  tone={detail.fp_oms_purchase_allowed ? "success" : "warning"}
                />
                {detail.catalog_flags.map((flag) => (
                  <StatusBadge key={flag} label={flag.replaceAll("_", " ")} tone="warning" />
                ))}
                <StatusBadge
                  label={detail.is_visible ? "Visible on site" : "Hidden on site"}
                  tone={detail.is_visible ? "success" : "danger"}
                />
              </div>

              {canManage ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Catalog overrides</CardTitle>
                    <CardDescription>
                      Admin controls persist across nightly lifecycle sync.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-compact">
                        <span className="text-muted-foreground">Visibility</span>
                        <select
                          className="h-8 w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 text-compact"
                          value={visibility}
                          onChange={(event) => setVisibility(event.target.value)}
                        >
                          <option value="AUTO">Auto</option>
                          <option value="FORCE_SHOW">Force show</option>
                          <option value="FORCE_HIDE">Force hide</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-compact">
                        <span className="text-muted-foreground">Investability</span>
                        <select
                          className="h-8 w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 text-compact"
                          value={investability}
                          onChange={(event) => setInvestability(event.target.value)}
                        >
                          <option value="AUTO">Auto</option>
                          <option value="BLOCK_ORDERS">Block orders</option>
                        </select>
                      </label>
                    </div>
                    <Input
                      placeholder="Reason (required for hide/block)"
                      value={disableReason}
                      onChange={(event) => setDisableReason(event.target.value)}
                    />
                    {detail.disabled_reason ? (
                      <p className="text-caption text-muted-foreground">
                        Last reason: {detail.disabled_reason}
                      </p>
                    ) : null}
                    <Button size="sm" disabled={saving} onClick={() => void handleSaveOverrides()}>
                      {saving ? "Saving..." : "Save overrides"}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <FundContentPanel fundId={fundId} canManage={canManageContent} />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Identifiers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-compact">
                  <p><span className="text-muted-foreground">ISIN:</span> {detail.isin ?? "—"}</p>
                  <p><span className="text-muted-foreground">Scheme code:</span> {detail.scheme_code ?? "—"}</p>
                  <p><span className="text-muted-foreground">FP scheme:</span> {detail.fp_scheme_id ?? "—"}</p>
                  <p><span className="text-muted-foreground">Product:</span> {detail.product_code ?? "—"}</p>
                  <p><span className="text-muted-foreground">Category:</span> {detail.category_name ?? "—"}</p>
                  <p><span className="text-muted-foreground">SEBI:</span> {detail.sebi_category ?? "—"}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Returns</CardTitle>
                  <CardDescription>
                    As of {detail.metrics_as_of ? new Date(detail.metrics_as_of).toLocaleDateString() : "unknown"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-compact sm:grid-cols-4">
                  {(
                    [
                      ["1D", detail.returns.return_1d],
                      ["1W", detail.returns.return_1w],
                      ["1M", detail.returns.return_1m],
                      ["3M", detail.returns.return_3m],
                      ["6M", detail.returns.return_6m],
                      ["1Y", detail.returns.return_1y],
                      ["3Y", detail.returns.return_3y],
                      ["5Y", detail.returns.return_5y],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-[var(--radius-control)] bg-muted px-3 py-2">
                      <p className="text-caption text-muted-foreground">{label}</p>
                      <p className="font-medium text-foreground">{formatPercent(value)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LineChart className="size-4 text-primary" />
                    NAV history (90d)
                  </CardTitle>
                  <CardDescription>
                    Latest {formatNav(detail.latest_nav)} on{" "}
                    {detail.latest_nav_date
                      ? new Date(detail.latest_nav_date).toLocaleDateString()
                      : "—"}{" "}
                    · {detail.nav_row_count ?? 0} total rows
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {navHistory ? <NavSparkline points={navHistory.points} /> : null}
                  <div className="max-h-48 overflow-y-auto rounded-[var(--radius-control)] border border-border">
                    <table className="w-full text-caption">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-right font-medium">NAV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(navHistory?.points ?? []).slice().reverse().slice(0, 30).map((point) => (
                          <tr key={point.date} className="border-t border-border">
                            <td className="px-3 py-1.5">{new Date(point.date).toLocaleDateString()}</td>
                            <td className="px-3 py-1.5 text-right">{formatNav(point.nav)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export default function MutualFundsAdminPage() {
  const { hasPermission } = useAdminAuth();
  const canReadCatalog = hasPermission("mf.catalog.read");
  const canManageCatalog = hasPermission("mf.catalog.manage");
  const canManageContent = hasPermission("mf.content.manage");
  const canManageRules = hasPermission("mf.rules.manage");
  const canPublishCatalog = hasPermission("mf.catalog.publish");
  const canReadAmcs = hasPermission("mf.amcs.read");
  const canManageAmcs = hasPermission("mf.amcs.manage");
  const canReadJobs = hasPermission("mf.jobs.read");
  const canRunJobs = hasPermission("mf.jobs.run");

  const defaultTab: TabKey = canReadCatalog ? "overview" : canReadJobs ? "operations" : "amcs";
  const [tab, setTab] = useState<TabKey>(defaultTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<
    | {
        kind: "fund-disable" | "amc-kill";
        fund?: MfFundAdmin;
        amc?: MfAmc;
      }
    | null
  >(null);

  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchMfOverview>> | null>(null);
  const [categories, setCategories] = useState<MfCategoryAdmin[]>([]);
  const [funds, setFunds] = useState<MfFundAdmin[]>([]);
  const [fundPage, setFundPage] = useState(1);
  const [fundTotal, setFundTotal] = useState(0);
  const [fundHasMore, setFundHasMore] = useState(false);
  const [fundSearch, setFundSearch] = useState("");
  const [fundLifecycle, setFundLifecycle] = useState("");
  const [fundCategory, setFundCategory] = useState("");
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
  const [selectedAmcContent, setSelectedAmcContent] = useState<MfAmc | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MfCategoryAdmin | null>(null);
  const [amcs, setAmcs] = useState<MfAmc[]>([]);
  const [jobs, setJobs] = useState<MfJob[]>([]);
  const [runs, setRuns] = useState<MfIngestionRun[]>([]);

  const tabs = useMemo(
    () =>
      [
        canReadCatalog ? { key: "overview" as const, label: "Overview", icon: BarChart3 } : null,
        canReadCatalog ? { key: "health" as const, label: "Health", icon: HeartPulse } : null,
        canReadCatalog ? { key: "staging" as const, label: "Staging", icon: Database } : null,
        canReadCatalog ? { key: "categories" as const, label: "Categories", icon: Layers } : null,
        canReadCatalog ? { key: "funds" as const, label: "Funds", icon: TrendingUp } : null,
        canReadCatalog ? { key: "content" as const, label: "Content", icon: FileText } : null,
        canReadCatalog ? { key: "rules" as const, label: "Rules", icon: GitBranch } : null,
        canReadCatalog ? { key: "bulk" as const, label: "Bulk import", icon: Upload } : null,
        canReadAmcs ? { key: "amcs" as const, label: "AMCs", icon: Building2 } : null,
        canReadJobs ? { key: "operations" as const, label: "Operations", icon: Settings2 } : null,
      ].filter(Boolean) as Array<{ key: TabKey; label: string; icon: typeof BarChart3 }>,
    [canReadAmcs, canReadCatalog, canReadJobs]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tasks: Promise<unknown>[] = [];
      if (canReadCatalog) {
        tasks.push(fetchMfOverview().then(setOverview));
        tasks.push(fetchMfCategories().then(setCategories));
        tasks.push(
          fetchMfFunds({
            page: fundPage,
            page_size: 25,
            q: fundSearch || undefined,
            lifecycle_status: fundLifecycle || undefined,
            category_slug: fundCategory || undefined,
          }).then((result) => {
            setFunds(result.items);
            setFundTotal(result.total);
            setFundHasMore(result.has_more);
          })
        );
      }
      if (canReadAmcs) {
        tasks.push(fetchMfAmcs().then(setAmcs));
      } else if (canManageCatalog) {
        tasks.push(fetchMfAmcs().then(setAmcs));
      }
      if (canReadJobs) {
        tasks.push(fetchMfJobs().then(setJobs));
        tasks.push(fetchMfIngestionRuns(15).then(setRuns));
      }
      await Promise.all(tasks);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load mutual fund console."));
    } finally {
      setLoading(false);
    }
  }, [
    canReadAmcs,
    canReadCatalog,
    canReadJobs,
    fundCategory,
    fundLifecycle,
    fundPage,
    fundSearch,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleAmc = async (amc: MfAmc) => {
    if (!canManageAmcs) return;
    setActionLoading(`amc-${amc.id}`);
    setMessage("");
    try {
      await updateMfAmc(amc.id, { is_active: !amc.is_active });
      setMessage(`${amc.name} empanelment updated.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update AMC."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleFundActive = (fund: MfFundAdmin) => {
    if (!canManageCatalog) return;
    if (fund.fund_active) {
      setReasonModal({ kind: "fund-disable", fund });
      return;
    }
    void (async () => {
      setActionLoading(`fund-${fund.fund_id}`);
      setMessage("");
      try {
        await updateMfFund(fund.fund_id, { is_active: true });
        setMessage(`${fund.scheme_name} enabled.`);
        await loadData();
      } catch (err) {
        setError(getErrorMessage(err, "Could not enable fund."));
      } finally {
        setActionLoading(null);
      }
    })();
  };

  const handleConfirmReasonModal = async (reason: string) => {
    if (!reasonModal) return;
    setActionLoading("reason-modal");
    setMessage("");
    setError("");
    try {
      if (reasonModal.kind === "fund-disable" && reasonModal.fund) {
        await updateMfFund(reasonModal.fund.fund_id, {
          is_active: false,
          admin_visibility: "FORCE_HIDE",
          reason,
        });
        setMessage(`${reasonModal.fund.scheme_name} disabled.`);
      } else if (reasonModal.kind === "amc-kill" && reasonModal.amc) {
        await updateMfAmc(reasonModal.amc.id, { admin_kill_switch: true, reason });
        setMessage(`${reasonModal.amc.name} kill switch enabled.`);
      }
      setReasonModal(null);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not apply catalog change."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisableAmcKillSwitch = async (amc: MfAmc) => {
    if (!canManageAmcs) return;
    setActionLoading(`amc-kill-${amc.id}`);
    setMessage("");
    try {
      await updateMfAmc(amc.id, { admin_kill_switch: false });
      setMessage(`${amc.name} kill switch cleared.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not clear kill switch."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunJob = async (jobName: string) => {
    if (!canRunJobs) return;
    setActionLoading(`job-${jobName}`);
    setMessage("");
    try {
      const result = await runMfJob(jobName);
      setMessage(`Job ${result.job} triggered.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not run job."));
    } finally {
      setActionLoading(null);
    }
  };

  const hasAnyMfAccess = canReadCatalog || canReadAmcs || canReadJobs;

  return (
    <AdminShell>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="border-b border-border bg-card shadow-zynd-low">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="inline-flex items-center gap-1 text-compact text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3.5" />
                Console
              </Link>
              <span className="font-heading text-h4 font-bold tracking-tight text-foreground">
                Mutual Funds
              </span>
            </div>
            <Button variant="outline" disabled={loading} onClick={() => void loadData()}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          {!hasAnyMfAccess ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-8 text-compact text-muted-foreground">
                <AlertTriangle className="size-4 text-warning" />
                You do not have mutual fund admin permissions.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap gap-2">
                {tabs.map(({ key, label, icon: Icon }) => (
                  <Button
                    key={key}
                    variant={tab === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTab(key)}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </Button>
                ))}
              </div>

              {error ? (
                <div className="mb-4 rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-compact text-destructive">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="mb-4 rounded-[var(--radius-card)] border border-success/30 bg-success/5 px-4 py-3 text-compact text-foreground">
                  {message}
                </div>
              ) : null}

              {tab === "overview" && canReadCatalog ? (
                <section className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Total funds", overview?.total_funds ?? 0],
                      ["Active products", overview?.active_products ?? 0],
                      ["Empanelled AMCs", overview?.empanelled_amcs ?? 0],
                      ["NAV rows", overview?.nav_rows ?? 0],
                    ].map(([label, value]) => (
                      <Card key={label}>
                        <CardHeader>
                          <CardDescription>{label}</CardDescription>
                          <CardTitle className="text-h3">{loading ? "…" : value}</CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Catalog snapshot</CardTitle>
                      <CardDescription>
                        {overview?.total_products ?? 0} products across {overview?.total_categories ?? 0} categories ·{" "}
                        {overview?.total_amcs ?? 0} AMCs in master
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </section>
              ) : null}

              {tab === "staging" && canReadCatalog ? (
                <SchemeStagingPanel canPublish={canPublishCatalog} />
              ) : null}

              {tab === "health" && canReadCatalog ? (
                <CatalogHealthPanel
                  onOpenFund={(fundId) => {
                    setSelectedFundId(fundId);
                    setTab("funds");
                  }}
                />
              ) : null}

              {tab === "categories" && canReadCatalog ? (
                <section>
                  <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
                    <table className="w-full text-compact">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Category</th>
                          <th className="px-4 py-3 text-left font-medium">Slug</th>
                          <th className="px-4 py-3 text-right font-medium">Order</th>
                          <th className="px-4 py-3 text-right font-medium">Funds</th>
                          <th className="px-4 py-3 text-right font-medium">Active</th>
                          <th className="px-4 py-3 text-right font-medium">Visible</th>
                          <th className="px-4 py-3 text-right font-medium">Curate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                              Loading categories...
                            </td>
                          </tr>
                        ) : categories.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                              No categories found.
                            </td>
                          </tr>
                        ) : (
                          categories.map((category) => (
                            <tr key={category.id} className="border-t border-border">
                              <td className="px-4 py-3 font-medium">{category.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{category.slug}</td>
                              <td className="px-4 py-3 text-right">{category.display_order}</td>
                              <td className="px-4 py-3 text-right">{category.fund_count}</td>
                              <td className="px-4 py-3 text-right">{category.active_fund_count}</td>
                              <td className="px-4 py-3 text-right">
                                {category.is_visible ? "Yes" : "No"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="sm"
                                  variant={selectedCategory?.id === category.id ? "default" : "outline"}
                                  onClick={() =>
                                    setSelectedCategory((current) =>
                                      current?.id === category.id ? null : category
                                    )
                                  }
                                >
                                  {selectedCategory?.id === category.id ? "Close" : "Curate"}
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {selectedCategory ? (
                    <CategoryCurationPanel
                      category={selectedCategory}
                      amcs={amcs}
                      canManage={canManageCatalog}
                      onUpdated={() => void loadData()}
                    />
                  ) : null}
                </section>
              ) : null}

              {tab === "funds" && canReadCatalog ? (
                <section className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Search scheme, ISIN, or product code"
                        value={fundSearch}
                        onChange={(event) => {
                          setFundSearch(event.target.value);
                          setFundPage(1);
                        }}
                      />
                    </div>
                    <select
                      className="h-8 rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 text-compact"
                      value={fundLifecycle}
                      onChange={(event) => {
                        setFundLifecycle(event.target.value);
                        setFundPage(1);
                      }}
                    >
                      <option value="">All lifecycle</option>
                      <option value="ACTIVE">Active</option>
                      <option value="DRAFT">Draft</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                    <select
                      className="h-8 rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 text-compact"
                      value={fundCategory}
                      onChange={(event) => {
                        setFundCategory(event.target.value);
                        setFundPage(1);
                      }}
                    >
                      <option value="">All categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.slug}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
                    <table className="w-full text-compact">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Scheme</th>
                          <th className="px-4 py-3 text-left font-medium">AMC</th>
                          <th className="px-4 py-3 text-left font-medium">Status</th>
                          <th className="px-4 py-3 text-right font-medium">3Y</th>
                          <th className="px-4 py-3 text-right font-medium">NAV</th>
                          {canManageCatalog ? (
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={canManageCatalog ? 6 : 5} className="px-4 py-6 text-muted-foreground">
                              Loading funds...
                            </td>
                          </tr>
                        ) : funds.length === 0 ? (
                          <tr>
                            <td colSpan={canManageCatalog ? 6 : 5} className="px-4 py-6 text-muted-foreground">
                              No funds match your filters.
                            </td>
                          </tr>
                        ) : (
                          funds.map((fund) => (
                            <tr
                              key={fund.fund_id}
                              className="cursor-pointer border-t border-border hover:bg-muted/40"
                              onClick={() => setSelectedFundId(fund.fund_id)}
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium">{fund.scheme_name}</p>
                                <p className="text-caption text-muted-foreground">
                                  {fund.isin ?? fund.product_code ?? "—"}
                                </p>
                              </td>
                              <td className="px-4 py-3">{fund.amc_name}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  <StatusBadge
                                    label={fund.lifecycle_status ?? "—"}
                                    tone={lifecycleTone(fund.lifecycle_status)}
                                  />
                                  {fund.catalog_flags.length ? (
                                    <StatusBadge label={`${fund.catalog_flags.length} flags`} tone="warning" />
                                  ) : null}
                                  {fund.health_flags?.map((flag) => (
                                    <StatusBadge
                                      key={flag}
                                      label={flag.replaceAll("_", " ")}
                                      tone={flag === "stale_nav" ? "danger" : "warning"}
                                    />
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">{formatPercent(fund.return_3y)}</td>
                              <td className="px-4 py-3 text-right">{formatNav(fund.latest_nav)}</td>
                              {canManageCatalog ? (
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={actionLoading === `fund-${fund.fund_id}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleToggleFundActive(fund);
                                    }}
                                  >
                                    {fund.fund_active ? "Disable" : "Enable"}
                                  </Button>
                                </td>
                              ) : null}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-caption text-muted-foreground">
                      Page {fundPage} · {fundTotal} funds
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={fundPage <= 1 || loading}
                        onClick={() => setFundPage((page) => Math.max(1, page - 1))}
                      >
                        <ChevronLeft className="size-3.5" />
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!fundHasMore || loading}
                        onClick={() => setFundPage((page) => page + 1)}
                      >
                        Next
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </section>
              ) : null}

              {tab === "amcs" && canReadAmcs ? (
                <section className="space-y-3">
                  {loading ? (
                    <p className="text-compact text-muted-foreground">Loading AMCs...</p>
                  ) : amcs.length === 0 ? (
                    <Card>
                      <CardContent className="py-6 text-compact text-muted-foreground">
                        No AMCs found.
                      </CardContent>
                    </Card>
                  ) : (
                    amcs.map((amc) => (
                      <Card key={amc.id}>
                        <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-foreground">{amc.name}</p>
                            <p className="text-caption text-muted-foreground">
                              {amc.slug} · AMFI {amc.amc_code ?? "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge
                              label={amc.is_active ? "Empanelled" : "Not empanelled"}
                              tone={amc.is_active ? "success" : "warning"}
                            />
                            {amc.admin_kill_switch ? (
                              <StatusBadge label="Kill switch" tone="danger" />
                            ) : null}
                            {canManageAmcs ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedAmcContent(amc)}
                                >
                                  Content
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actionLoading === `amc-${amc.id}`}
                                  onClick={() => void handleToggleAmc(amc)}
                                >
                                  {amc.is_active ? "Disable" : "Empanel"}
                                </Button>
                                {amc.admin_kill_switch ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={actionLoading === `amc-kill-${amc.id}`}
                                    onClick={() => void handleDisableAmcKillSwitch(amc)}
                                  >
                                    Clear kill switch
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={actionLoading === `amc-kill-${amc.id}`}
                                    onClick={() => setReasonModal({ kind: "amc-kill", amc })}
                                  >
                                    Kill switch
                                  </Button>
                                )}
                              </>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </section>
              ) : null}

              {tab === "content" && canReadCatalog ? (
                <section>
                  <ComplianceSettingsPanel canManage={canManageContent} />
                </section>
              ) : null}

              {tab === "rules" && canReadCatalog ? (
                <section>
                  <CatalogRulesPanel
                    canManageRules={canManageRules}
                    canPublish={canPublishCatalog}
                  />
                </section>
              ) : null}

              {tab === "bulk" && canReadCatalog ? (
                <section>
                  <BulkImportPanel canPublish={canPublishCatalog} />
                </section>
              ) : null}

              {tab === "operations" && canReadJobs ? (
                <section className="space-y-8">
                  <div>
                    <h2 className="mb-3 font-heading text-h4 font-semibold">Scheduler jobs</h2>
                    <div className="space-y-3">
                      {jobs.map((job) => (
                        <Card key={job.name}>
                          <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-medium">{job.name}</p>
                              <p className="text-caption text-muted-foreground">
                                {job.description} · cron {job.cron}
                              </p>
                              {job.last_run ? (
                                <p className="mt-1 text-caption text-muted-foreground">
                                  Last: {job.last_run.status ?? "unknown"}
                                  {job.last_run.finished_at
                                    ? ` · ${new Date(job.last_run.finished_at).toLocaleString()}`
                                    : ""}
                                </p>
                              ) : null}
                            </div>
                            {canRunJobs ? (
                              <Button
                                size="sm"
                                disabled={actionLoading === `job-${job.name}`}
                                onClick={() => void handleRunJob(job.name)}
                              >
                                {actionLoading === `job-${job.name}` ? "Running..." : "Run now"}
                              </Button>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="mb-3 font-heading text-h4 font-semibold">Recent ingestion runs</h2>
                    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
                      <table className="w-full text-compact">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Job</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Started</th>
                            <th className="px-4 py-3 text-right font-medium">Processed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                                No recent runs.
                              </td>
                            </tr>
                          ) : (
                            runs.map((run) => (
                              <tr key={run.run_uuid ?? `${run.job_name}-${run.started_at}`} className="border-t border-border">
                                <td className="px-4 py-3">{run.job_name ?? "—"}</td>
                                <td className="px-4 py-3">{run.status ?? "—"}</td>
                                <td className="px-4 py-3">
                                  {run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
                                </td>
                                <td className="px-4 py-3 text-right">{run.records_processed ?? "—"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </main>
      </div>

      {selectedFundId != null ? (
        <FundDetailDrawer
          fundId={selectedFundId}
          canManage={canManageCatalog}
          canManageContent={canManageContent}
          onClose={() => setSelectedFundId(null)}
          onUpdated={() => void loadData()}
        />
      ) : null}

      {selectedAmcContent ? (
        <AmcContentDrawer
          amcId={selectedAmcContent.id}
          amcName={selectedAmcContent.name}
          canManage={canManageContent}
          onClose={() => setSelectedAmcContent(null)}
        />
      ) : null}

      {reasonModal ? (
        <ReasonModal
          title={reasonModal.kind === "fund-disable" ? "Disable fund" : "Enable AMC kill switch"}
          description={
            reasonModal.kind === "fund-disable"
              ? `Hide ${reasonModal.fund?.scheme_name ?? "this fund"} from the catalog and block orders.`
              : `Instantly hide all funds from ${reasonModal.amc?.name ?? "this AMC"}.`
          }
          confirmLabel={reasonModal.kind === "fund-disable" ? "Disable fund" : "Enable kill switch"}
          loading={actionLoading === "reason-modal"}
          onCancel={() => setReasonModal(null)}
          onConfirm={(reason) => void handleConfirmReasonModal(reason)}
        />
      ) : null}
    </AdminShell>
  );
}
