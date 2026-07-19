"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Database,
  FileText,
  Upload,
  HeartPulse,
  Layers,
  LineChart,
  MoreHorizontal,
  Package,
  Settings2,
  TrendingUp,
} from "lucide-react";

import { BulkImportPanel } from "@/components/mf/bulk-import-panel";
import { AmcContentDrawer } from "@/components/mf/amc-content-drawer";
import { AmcLogo } from "@/components/mf/amc-logo";
import { CatalogHealthPanel } from "@/components/mf/catalog-health-panel";
import { CategoryCurationDialog } from "@/components/mf/category-curation-panel";
import { ContentRulesPanel } from "@/components/mf/content-rules-panel";
import { FundContentPanel } from "@/components/mf/fund-content-panel";
import { MfOperationsPanel } from "@/components/mf/mf-operations-panel";
import { lifecycleTone, MfStatusChip } from "@/components/mf/mf-status-chip";
import { AdminSectionBreadcrumb } from "@/components/dashboard/admin-section-breadcrumb";
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";
import { SchemeStagingPanel } from "@/components/mf/scheme-staging-panel";
import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import {
  AdminDialogFooterActions,
  AdminFormDialog,
} from "@/components/ui/admin-dialog-presets";
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
  paginateItems,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminFormSkeleton, AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  fetchMfAmcs,
  fetchMfCategories,
  fetchMfFundDetail,
  fetchMfFundNavs,
  fetchMfFunds,
  fetchMfOverview,
  updateMfAmc,
  updateMfFund,
  type MfAmc,
  type MfCategoryAdmin,
  type MfFundAdmin,
  type MfFundAdminDetail,
  type MfFundNavHistory,
} from "@/lib/mf-admin-api";

type TabKey = "overview" | "health" | "staging" | "categories" | "funds" | "content" | "bulk" | "operations";

const FUND_PAGE_SIZE = 25;
const ALL = "all";


function formatPercent(value: number | null | undefined) {
  if (value == null) return "NA";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatReturnDisplay(value: number | null | undefined) {
  if (value == null) {
    return { text: "NA", tone: "muted" as const };
  }
  return {
    text: `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`,
    tone: value > 0 ? ("positive" as const) : value < 0 ? ("negative" as const) : ("muted" as const),
  };
}

function returnToneClass(tone: "positive" | "negative" | "muted") {
  if (tone === "positive") return "text-success";
  if (tone === "negative") return "text-destructive";
  return "text-muted-foreground";
}

function formatNav(value: number | null | undefined) {
  if (value == null) return "NA";
  return value.toFixed(4);
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
  open,
  title,
  description,
  confirmLabel,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <AdminFormDialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      icon={AlertTriangle}
      iconTone="warning"
      size="sm"
      footer={
        <AdminDialogFooterActions
          cancelLabel="Cancel"
          confirmLabel={confirmLabel}
          confirmVariant="destructive"
          loading={loading}
          loadingLabel="Saving..."
          confirmDisabled={!reason.trim()}
          onCancel={onCancel}
          onConfirm={() => onConfirm(reason.trim())}
        />
      }
    >
      <Input
        placeholder="Reason (required)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </AdminFormDialog>
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
    <AdminDrawer
      open
      onClose={onClose}
      subtitle="Fund detail"
      title={detail?.scheme_name ?? "Fund detail"}
      icon={Package}
      size="lg"
    >
          {loading ? (
            <AdminFormSkeleton rows={6} />
          ) : error ? (
            <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>
          ) : detail ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <MfStatusChip label={detail.lifecycle_status ?? "UNKNOWN"} tone={lifecycleTone(detail.lifecycle_status)} />
                <MfStatusChip
                  label={detail.amc_empanelled ? "AMC empanelled" : "AMC not empanelled"}
                  tone={detail.amc_empanelled ? "success" : "warning"}
                />
                <MfStatusChip
                  label={detail.fp_oms_purchase_allowed ? "Purchasable" : "Not purchasable"}
                  tone={detail.fp_oms_purchase_allowed ? "success" : "warning"}
                />
                {detail.catalog_flags.map((flag) => (
                  <MfStatusChip key={flag} label={flag.replaceAll("_", " ")} tone="warning" />
                ))}
                <MfStatusChip
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
                  <div className="max-h-scroll-sm overflow-y-auto rounded-[var(--radius-control)] border border-border">
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
    </AdminDrawer>
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

  const defaultTab: TabKey = canReadCatalog ? "overview" : "operations";
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
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [amcs, setAmcs] = useState<MfAmc[]>([]);
  const [amcSearch, setAmcSearch] = useState("");
  const [amcPage, setAmcPage] = useState(0);
  const tabs = useMemo(
    () =>
      [
        canReadCatalog ? { key: "overview" as const, label: "Overview", icon: BarChart3 } : null,
        canReadCatalog ? { key: "funds" as const, label: "Funds", icon: TrendingUp } : null,
        canReadCatalog ? { key: "health" as const, label: "Health", icon: HeartPulse } : null,
        canReadCatalog ? { key: "staging" as const, label: "Staging", icon: Database } : null,
        canReadCatalog ? { key: "categories" as const, label: "Categories", icon: Layers } : null,
        canReadCatalog ? { key: "content" as const, label: "Content & rules", icon: FileText } : null,
        canReadCatalog ? { key: "bulk" as const, label: "Bulk import", icon: Upload } : null,
        canReadJobs ? { key: "operations" as const, label: "Operations", icon: Settings2 } : null,
      ].filter(Boolean) as Array<{ key: TabKey; label: string; icon: typeof BarChart3 }>,
    [canReadCatalog, canReadJobs]
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
            page_size: FUND_PAGE_SIZE,
            q: fundSearch || undefined,
            lifecycle_status: fundLifecycle || undefined,
            category_slug: fundCategory || undefined,
          }).then((result) => {
            setFunds(result.items);
            setFundTotal(result.total);
            setFundHasMore(result.has_more);
          })
        );
        tasks.push(fetchMfAmcs().then(setAmcs));
      }
      await Promise.all(tasks);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load mutual fund console."));
    } finally {
      setLoading(false);
    }
  }, [
    canReadCatalog,
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

  useEffect(() => {
    if (!tabs.some((item) => item.key === tab)) {
      setTab(tabs[0]?.key ?? defaultTab);
    }
  }, [defaultTab, tab, tabs]);

  const fundTotalPages = Math.max(1, Math.ceil(fundTotal / FUND_PAGE_SIZE));

  const overviewMetrics = useMemo(
    () => [
      {
        key: "total-funds",
        label: "Total funds",
        value: (overview?.total_funds ?? 0).toLocaleString(),
        icon: TrendingUp,
        tone: "info" as const,
      },
      {
        key: "active-products",
        label: "Active products",
        value: (overview?.active_products ?? 0).toLocaleString(),
        icon: Package,
        tone: "success" as const,
      },
      {
        key: "empanelled-amcs",
        label: "Empanelled AMCs",
        value: (overview?.empanelled_amcs ?? 0).toLocaleString(),
        icon: Building2,
        tone: "default" as const,
      },
      {
        key: "nav-rows",
        label: "NAV rows",
        value: (overview?.nav_rows ?? 0).toLocaleString(),
        icon: LineChart,
        tone: "muted" as const,
      },
    ],
    [overview],
  );

  const filteredAmcs = useMemo(() => {
    const query = amcSearch.trim().toLowerCase();
    if (!query) return amcs;
    return amcs.filter(
      (amc) =>
        amc.name.toLowerCase().includes(query) ||
        amc.slug.toLowerCase().includes(query) ||
        String(amc.amc_code ?? "").toLowerCase().includes(query),
    );
  }, [amcSearch, amcs]);

  const amcPagination = useMemo(
    () => paginateItems(filteredAmcs, amcPage, ADMIN_TABLE_PAGE_SIZE),
    [amcPage, filteredAmcs],
  );

  useEffect(() => {
    setAmcPage(0);
  }, [amcSearch]);

  const hasAnyMfAccess = canReadCatalog || canReadAmcs || canReadJobs;

  return (
    <>
      {!hasAnyMfAccess ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view mutual fund administration.
        </AdminFeedbackMessage>
      ) : (
        <div className="space-y-6">
          <AdminSectionBreadcrumb segments={[{ label: "Mutual funds" }]} />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-heading text-h3 font-semibold text-foreground">Mutual funds</h1>
              <p className="mt-1 text-caption text-muted-foreground">
                Catalog, content, AMCs, and ingestion operations.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="rounded-[var(--radius-card)] border border-border bg-primary/10 p-3 text-primary">
                <TrendingUp className="size-5" />
              </div>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="gap-6">
            <TabsList variant="line" className="w-fit justify-start border-b border-border">
              {tabs.map(({ key, label, icon: Icon }) => (
                <TabsTrigger key={key} value={key} className="gap-2 px-4 py-2">
                  <Icon className="size-4 shrink-0" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="min-w-0">
              {error ? (
                <AdminFeedbackMessage variant="destructive" className="mb-4">
                  {error}
                </AdminFeedbackMessage>
              ) : null}
              {message ? (
                <AdminFeedbackMessage variant="success" className="mb-4">
                  {message}
                </AdminFeedbackMessage>
              ) : null}

              {canReadCatalog ? (
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {overviewMetrics.map((metric) => (
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

                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <AdminSectionTitle icon={Building2}>AMCs</AdminSectionTitle>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <AdminSearchInput
                          containerClassName="max-w-sm sm:w-56"
                          placeholder="Search AMCs"
                          value={amcSearch}
                          onChange={(event) => {
                            setAmcSearch(event.target.value);
                            setAmcPage(0);
                          }}
                        />
                        <StatusBadge variant="info" showIcon={false}>
                          {(overview?.total_categories ?? categories.length).toLocaleString()} categories
                        </StatusBadge>
                        <StatusBadge variant="neutral" showIcon={false}>
                          {(overview?.total_amcs ?? amcs.length).toLocaleString()} AMCs
                        </StatusBadge>
                      </div>
                    </div>

                    <AdminDataTable minWidth="default">
                      <AdminTableHeader>
                        <tr>
                          <AdminTableHeadCell>AMC</AdminTableHeadCell>
                          <AdminTableHeadCell>Status</AdminTableHeadCell>
                          <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
                        </tr>
                      </AdminTableHeader>
                      <AdminTableBody>
                        {loading ? (
                          <AdminTableSkeletonRows columns={3} />
                        ) : amcPagination.items.length === 0 ? (
                          <AdminTableStateRow colSpan={3}>No AMCs match your search.</AdminTableStateRow>
                        ) : (
                          amcPagination.items.map((amc) => (
                            <AdminTableRow key={amc.id}>
                              <AdminTableCell>
                                <div className="flex min-w-0 items-start gap-3">
                                  <AmcLogo name={amc.name} logoUrl={amc.logo_url} className="mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="font-medium text-foreground">{amc.name}</p>
                                    <p className="mt-0.5 text-caption text-muted-foreground">
                                      {amc.slug} · AMFI {amc.amc_code ?? "—"}
                                    </p>
                                  </div>
                                </div>
                              </AdminTableCell>
                              <AdminTableCell>
                                <div className="flex flex-wrap gap-1">
                                  <MfStatusChip
                                    label={amc.is_active ? "Empanelled" : "Not empanelled"}
                                    tone={amc.is_active ? "success" : "warning"}
                                  />
                                  {amc.admin_kill_switch ? (
                                    <MfStatusChip label="Kill switch" tone="danger" />
                                  ) : null}
                                </div>
                              </AdminTableCell>
                              <AdminTableCell className="text-right">
                                {canManageAmcs || canManageContent ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      render={
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label={`Actions for ${amc.name}`}
                                        >
                                          <MoreHorizontal className="size-4" />
                                        </Button>
                                      }
                                    />
                                    <DropdownMenuContent align="end">
                                      {canManageContent ? (
                                        <DropdownMenuItem onClick={() => setSelectedAmcContent(amc)}>
                                          Edit content
                                        </DropdownMenuItem>
                                      ) : null}
                                      {canManageAmcs ? (
                                        <>
                                          {canManageContent ? <DropdownMenuSeparator /> : null}
                                          <DropdownMenuItem
                                            disabled={actionLoading === `amc-${amc.id}`}
                                            onClick={() => void handleToggleAmc(amc)}
                                          >
                                            {amc.is_active ? "Disable empanelment" : "Empanel AMC"}
                                          </DropdownMenuItem>
                                          {amc.admin_kill_switch ? (
                                            <DropdownMenuItem
                                              disabled={actionLoading === `amc-kill-${amc.id}`}
                                              onClick={() => void handleDisableAmcKillSwitch(amc)}
                                            >
                                              Clear kill switch
                                            </DropdownMenuItem>
                                          ) : (
                                            <DropdownMenuItem
                                              variant="destructive"
                                              disabled={actionLoading === `amc-kill-${amc.id}`}
                                              onClick={() => setReasonModal({ kind: "amc-kill", amc })}
                                            >
                                              Enable kill switch
                                            </DropdownMenuItem>
                                          )}
                                        </>
                                      ) : null}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </AdminTableCell>
                            </AdminTableRow>
                          ))
                        )}
                      </AdminTableBody>
                    </AdminDataTable>

                    {!loading && filteredAmcs.length > 0 ? (
                      <AdminTablePagination
                        page={amcPagination.page}
                        totalPages={amcPagination.totalPages}
                        hasPrevious={amcPagination.hasPrevious}
                        hasNext={amcPagination.hasNext}
                        disabled={loading}
                        onPrevious={() => setAmcPage((page) => Math.max(0, page - 1))}
                        onNext={() => setAmcPage((page) => page + 1)}
                      />
                    ) : null}
                  </div>
                </TabsContent>
              ) : null}

              {canReadCatalog ? (
                <TabsContent value="staging" className="mt-0">
                  <SchemeStagingPanel canPublish={canPublishCatalog} />
                </TabsContent>
              ) : null}

              {canReadCatalog ? (
                <TabsContent value="health" className="mt-0">
                  <CatalogHealthPanel
                    onOpenFund={(fundId) => {
                      setSelectedFundId(fundId);
                      setTab("funds");
                    }}
                  />
                </TabsContent>
              ) : null}

              {canReadCatalog ? (
                <TabsContent value="categories" className="mt-0 space-y-4">
                  <AdminDataTable minWidth="xl">
                    <AdminTableHeader>
                      <tr>
                        <AdminTableHeadCell>Category</AdminTableHeadCell>
                        <AdminTableHeadCell>Slug</AdminTableHeadCell>
                        <AdminTableHeadCell className="text-right">Order</AdminTableHeadCell>
                        <AdminTableHeadCell className="text-right">Funds</AdminTableHeadCell>
                        <AdminTableHeadCell className="text-right">Active</AdminTableHeadCell>
                        <AdminTableHeadCell>Visible</AdminTableHeadCell>
                        <AdminTableHeadCell className="text-right">Curate</AdminTableHeadCell>
                      </tr>
                    </AdminTableHeader>
                    <AdminTableBody>
                      {loading ? (
                        <AdminTableSkeletonRows columns={7} />
                      ) : categories.length === 0 ? (
                        <AdminTableStateRow colSpan={7}>No categories found.</AdminTableStateRow>
                      ) : (
                        categories.map((category) => (
                          <AdminTableRow key={category.id}>
                            <AdminTableCell className="font-medium text-foreground">{category.name}</AdminTableCell>
                            <AdminTableCell className="text-muted-foreground">{category.slug}</AdminTableCell>
                            <AdminTableCell className="text-right">{category.display_order}</AdminTableCell>
                            <AdminTableCell className="text-right">{category.fund_count}</AdminTableCell>
                            <AdminTableCell className="text-right">{category.active_fund_count}</AdminTableCell>
                            <AdminTableCell>
                              <MfStatusChip
                                label={category.is_visible ? "Visible" : "Hidden"}
                                tone={category.is_visible ? "success" : "neutral"}
                                showIcon={false}
                              />
                            </AdminTableCell>
                            <AdminTableCell className="text-right">
                              <Button
                                size="sm"
                                variant={
                                  selectedCategory?.id === category.id && categoryDialogOpen
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() => {
                                  setSelectedCategory(category);
                                  setCategoryDialogOpen(true);
                                }}
                              >
                                Curate
                              </Button>
                            </AdminTableCell>
                          </AdminTableRow>
                        ))
                      )}
                    </AdminTableBody>
                  </AdminDataTable>

                  {selectedCategory ? (
                    <CategoryCurationDialog
                      open={categoryDialogOpen}
                      category={
                        categories.find((item) => item.id === selectedCategory.id) ?? selectedCategory
                      }
                      amcs={amcs}
                      canManage={canManageCatalog}
                      onClose={() => {
                        setCategoryDialogOpen(false);
                        setSelectedCategory(null);
                      }}
                      onUpdated={() => void loadData()}
                    />
                  ) : null}
                </TabsContent>
              ) : null}

              {canReadCatalog ? (
                <TabsContent value="funds" className="mt-0 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <AdminSearchInput
                      containerClassName="max-w-sm"
                      placeholder="Search scheme, ISIN, or product"
                      value={fundSearch}
                      onChange={(event) => {
                        setFundSearch(event.target.value);
                        setFundPage(1);
                      }}
                    />

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Select
                        value={fundLifecycle || ALL}
                        onValueChange={(value) => {
                          setFundLifecycle(value === ALL ? "" : (value ?? ""));
                          setFundPage(1);
                        }}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="All lifecycle">
                            {fundLifecycle || "All lifecycle"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All lifecycle</SelectItem>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="DRAFT">Draft</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={fundCategory || ALL}
                        onValueChange={(value) => {
                          setFundCategory(value === ALL ? "" : (value ?? ""));
                          setFundPage(1);
                        }}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="All categories">
                            {categories.find((category) => category.slug === fundCategory)?.name ??
                              "All categories"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All categories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.slug}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <AdminDataTable minWidth="3xl">
                    <AdminTableHeader>
                      <tr>
                        <AdminTableHeadCell>Scheme</AdminTableHeadCell>
                        <AdminTableHeadCell>AMC</AdminTableHeadCell>
                        <AdminTableHeadCell>Status</AdminTableHeadCell>
                        <AdminTableHeadCell className="text-right">3Y</AdminTableHeadCell>
                        <AdminTableHeadCell className="text-right">NAV</AdminTableHeadCell>
                        {canManageCatalog ? (
                          <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
                        ) : null}
                      </tr>
                    </AdminTableHeader>
                    <AdminTableBody>
                      {loading ? (
                        <AdminTableSkeletonRows columns={canManageCatalog ? 6 : 5} />
                      ) : funds.length === 0 ? (
                        <AdminTableStateRow colSpan={canManageCatalog ? 6 : 5}>
                          No funds match your filters.
                        </AdminTableStateRow>
                      ) : (
                        funds.map((fund) => {
                          const return3y = formatReturnDisplay(fund.return_3y);

                          return (
                          <AdminTableRow
                            key={fund.fund_id}
                            onClick={() => setSelectedFundId(fund.fund_id)}
                          >
                            <AdminTableCell>
                              <p className="font-medium text-foreground">{fund.scheme_name}</p>
                              <p className="mt-0.5 text-caption text-muted-foreground">
                                {fund.isin ?? fund.product_code ?? "—"}
                              </p>
                            </AdminTableCell>
                            <AdminTableCell className="text-muted-foreground">{fund.amc_name}</AdminTableCell>
                            <AdminTableCell>
                              <div className="flex flex-wrap gap-1">
                                <MfStatusChip
                                  label={fund.lifecycle_status ?? "—"}
                                  tone={lifecycleTone(fund.lifecycle_status)}
                                  showIcon={false}
                                />
                                {fund.catalog_flags.length ? (
                                  <MfStatusChip
                                    label={`${fund.catalog_flags.length} flags`}
                                    tone="warning"
                                    showIcon={false}
                                  />
                                ) : null}
                              </div>
                            </AdminTableCell>
                            <AdminTableCell className="text-right">
                              <span
                                className={cn(
                                  "tabular-nums",
                                  returnToneClass(return3y.tone),
                                )}
                              >
                                {return3y.text}
                              </span>
                            </AdminTableCell>
                            <AdminTableCell className="text-right">
                              <span
                                className={cn(
                                  "tabular-nums",
                                  fund.latest_nav == null
                                    ? "text-muted-foreground"
                                    : "text-foreground",
                                )}
                              >
                                {formatNav(fund.latest_nav)}
                              </span>
                            </AdminTableCell>
                            {canManageCatalog ? (
                              <AdminTableCell className="text-right">
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
                              </AdminTableCell>
                            ) : null}
                          </AdminTableRow>
                          );
                        })
                      )}
                    </AdminTableBody>
                  </AdminDataTable>

                  {!loading && funds.length > 0 ? (
                    <AdminTablePagination
                      page={fundPage - 1}
                      totalPages={fundTotalPages}
                      hasPrevious={fundPage > 1}
                      hasNext={fundHasMore}
                      disabled={loading}
                      onPrevious={() => setFundPage((page) => Math.max(1, page - 1))}
                      onNext={() => setFundPage((page) => page + 1)}
                    />
                  ) : null}
                </TabsContent>
              ) : null}

              {canReadCatalog ? (
                <TabsContent value="content" className="mt-0">
                  <ContentRulesPanel
                    canManageContent={canManageContent}
                    canManageRules={canManageRules}
                    canPublish={canPublishCatalog}
                  />
                </TabsContent>
              ) : null}

              {canReadCatalog ? (
                <TabsContent value="bulk" className="mt-0">
                  <BulkImportPanel canPublish={canPublishCatalog} />
                </TabsContent>
              ) : null}

              {canReadJobs ? (
                <TabsContent value="operations" className="mt-0">
                  <MfOperationsPanel canRunJobs={canRunJobs} />
                </TabsContent>
              ) : null}
            </div>
          </Tabs>
        </div>
      )}

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
          open
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
    </>
  );
}
