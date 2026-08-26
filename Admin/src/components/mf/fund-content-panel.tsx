"use client";

import { useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { Button } from "@/components/ui/button";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminFormSkeleton } from "@/components/ui/admin-skeletons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchMfFundContent,
  updateMfFundContent,
  type MfFundContent,
} from "@/lib/mf-admin-api";


export function FundContentPanel({
  fundId,
  canManage,
}: {
  fundId: number;
  canManage: boolean;
}) {
  const [content, setContent] = useState<MfFundContent | null>(null);
  const [form, setForm] = useState({
    tagline: "",
    hero_badge: "",
    risk_label: "",
    benchmark_name: "",
    fund_manager_name: "",
    disclaimer_text: "",
    seo_slug: "",
    seo_meta_description: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchMfFundContent(fundId)
      .then((data) => {
        setContent(data);
        setForm({
          tagline: data.content.tagline ?? "",
          hero_badge: data.content.hero_badge ?? "",
          risk_label: data.content.risk_label ?? "",
          benchmark_name: data.content.benchmark_name ?? "",
          fund_manager_name: data.content.fund_manager_name ?? "",
          disclaimer_text: data.content.disclaimer_text ?? "",
          seo_slug: data.content.seo_slug ?? "",
          seo_meta_description: data.content.seo_meta_description ?? "",
        });
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load fund content.")))
      .finally(() => setLoading(false));
  }, [fundId]);

  const handleSave = async () => {
    if (!canManage) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateMfFundContent(fundId, form);
      setContent(updated);
      setMessage("Fund content saved.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not save fund content."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminFormSkeleton rows={4} />;
  }

  if (!content?.product_id) {
    return (
      <Card>
        <CardContent className="py-4 text-compact text-muted-foreground">
          This fund has no linked product yet. Content editing is unavailable.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Display content</CardTitle>
        <CardDescription>Marketing copy and SEO fields merged into the public invest API.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
        {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}
        {(
          [
            ["tagline", "Tagline", "Short pitch shown on fund cards"],
            ["hero_badge", "Hero badge", "e.g. Top performer"],
            ["risk_label", "Risk label", "Overrides card risk badge when set"],
            ["benchmark_name", "Benchmark", "Benchmark index name"],
            ["fund_manager_name", "Fund manager", "Lead manager name"],
            ["seo_slug", "SEO slug", "Future public fund page slug"],
          ] as const
        ).map(([key, label, hint]) => (
          <label key={key} className="block space-y-1 text-compact">
            <span className="text-muted-foreground">{label}</span>
            <Input
              value={form[key]}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              disabled={!canManage}
            />
            <span className="text-caption text-muted-foreground">{hint}</span>
          </label>
        ))}
        <label className="block space-y-1 text-compact">
          <span className="text-muted-foreground">Fund-specific disclaimer</span>
          <textarea
            className="min-h-field-sm w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 text-compact"
            value={form.disclaimer_text}
            onChange={(event) => setForm((current) => ({ ...current, disclaimer_text: event.target.value }))}
            disabled={!canManage}
          />
        </label>
        <label className="block space-y-1 text-compact">
          <span className="text-muted-foreground">SEO meta description</span>
          <textarea
            className="min-h-field-xs w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 text-compact"
            value={form.seo_meta_description}
            onChange={(event) =>
              setForm((current) => ({ ...current, seo_meta_description: event.target.value }))
            }
            disabled={!canManage}
          />
        </label>
        {canManage ? (
          <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save content"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
