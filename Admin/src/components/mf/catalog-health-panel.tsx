"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfCatalogHealth,
  fetchMfCatalogHealthIssues,
  type MfCatalogHealthIssue,
  type MfCatalogHealthSummary,
} from "@/lib/mf-admin-api";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function severityTone(severity: string) {
  if (severity === "critical") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-warning/30 bg-warning/10 text-warning";
}

export function CatalogHealthPanel({
  onOpenFund,
}: {
  onOpenFund?: (fundId: number) => void;
}) {
  const [summary, setSummary] = useState<MfCatalogHealthSummary | null>(null);
  const [issues, setIssues] = useState<MfCatalogHealthIssue[]>([]);
  const [activeCheck, setActiveCheck] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHealth = useCallback(async (check: string | null = activeCheck) => {
    setLoading(true);
    setError("");
    try {
      const [health, issuePage] = await Promise.all([
        fetchMfCatalogHealth(),
        fetchMfCatalogHealthIssues(check ?? undefined),
      ]);
      setSummary(health);
      setIssues(issuePage.items);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load catalog health."));
    } finally {
      setLoading(false);
    }
  }, [activeCheck]);

  useEffect(() => {
    void loadHealth(activeCheck);
  }, [activeCheck, loadHealth]);

  return (
    <section className="space-y-6">
      {error ? (
        <div className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-compact text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Public blocked</CardDescription>
            <CardTitle className="text-h3">
              {loading ? "…" : summary?.summary.public_blocked_by_health ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Stale NAV</CardDescription>
            <CardTitle className="text-h3">
              {loading ? "…" : summary?.summary.stale_nav ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Shallow history</CardDescription>
            <CardTitle className="text-h3">
              {loading ? "…" : summary?.summary.shallow_nav_history ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Missing 3Y</CardDescription>
            <CardTitle className="text-h3">
              {loading ? "…" : summary?.summary.missing_3y_metrics ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {summary ? (
        <p className="text-caption text-muted-foreground">
          Gates {summary.config.gates_enabled ? "enabled" : "disabled"} · stale NAV &gt;{" "}
          {summary.config.nav_stale_days} days · min {summary.config.min_nav_rows} NAV rows · updated{" "}
          {new Date(summary.generated_at).toLocaleString()}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeCheck === null ? "default" : "outline"}
          onClick={() => setActiveCheck(null)}
        >
          All issues
        </Button>
        {(summary?.checks ?? []).map((check) => (
          <Button
            key={check.key}
            size="sm"
            variant={activeCheck === check.key ? "default" : "outline"}
            onClick={() => setActiveCheck(check.key)}
          >
            {check.label} ({check.count})
          </Button>
        ))}
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void loadHealth(activeCheck)}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full text-compact">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Scheme / AMC</th>
              <th className="px-4 py-3 text-left font-medium">Flags</th>
              <th className="px-4 py-3 text-left font-medium">Latest NAV</th>
              <th className="px-4 py-3 text-right font-medium">Rows</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                  Loading health issues...
                </td>
              </tr>
            ) : issues.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                  No issues for this filter.
                </td>
              </tr>
            ) : (
              issues.map((issue, index) => (
                <tr
                  key={`${issue.product_id ?? issue.amc_id ?? index}`}
                  className={`border-t border-border ${issue.fund_id && onOpenFund ? "cursor-pointer hover:bg-muted/40" : ""}`}
                  onClick={() => {
                    if (issue.fund_id && onOpenFund) onOpenFund(issue.fund_id);
                  }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{issue.scheme_name ?? issue.amc_name ?? "—"}</p>
                    <p className="text-caption text-muted-foreground">
                      {issue.amc_name ?? "AMC issue"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {issue.health_flags.map((flag) => (
                        <span
                          key={flag}
                          className={`rounded-[var(--radius-control)] border px-2 py-0.5 text-caption ${severityTone(
                            flag === "stale_nav" || flag === "orphan_product" ? "critical" : "warning"
                          )}`}
                        >
                          {flag.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {issue.latest_nav_date
                      ? new Date(issue.latest_nav_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{issue.nav_row_count ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
