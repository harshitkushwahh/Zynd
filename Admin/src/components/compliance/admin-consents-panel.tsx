"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAdminConsentDraftVersion,
  fetchAdminConsentDefinitions,
  fetchAdminConsentStats,
  type AdminConsentDefinition,
  type AdminConsentStatsItem,
} from "@/lib/admin-api";
import { useAdminAuth } from "@/contexts/admin-auth-context";

export function AdminConsentsPanel() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("consents.manage");
  const [definitions, setDefinitions] = useState<AdminConsentDefinition[]>([]);
  const [stats, setStats] = useState<AdminConsentStatsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [defs, statRows] = await Promise.all([
        fetchAdminConsentDefinitions(),
        fetchAdminConsentStats(),
      ]);
      setDefinitions(defs);
      setStats(statRows);
      if (!draftKey && defs[0]?.key) setDraftKey(defs[0].key);
    } catch {
      setError("Unable to load consent catalog.");
    } finally {
      setLoading(false);
    }
  }, [draftKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateDraft = async () => {
    if (!draftKey || !versionLabel.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createAdminConsentDraftVersion(draftKey, {
        version_label: versionLabel.trim(),
        summary_text: summaryText.trim() || undefined,
        document_url: documentUrl.trim() || undefined,
      });
      setVersionLabel("");
      setSummaryText("");
      setDocumentUrl("");
      await load();
    } catch {
      setError("Could not create draft version.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-caption text-muted-foreground">Loading consent catalog…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? <AdminFeedbackMessage variant="error">{error}</AdminFeedbackMessage> : null}

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="min-w-full text-left text-caption">
          <thead className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Published</th>
              <th className="px-4 py-3 font-medium">Acceptances</th>
            </tr>
          </thead>
          <tbody>
            {definitions.map((item) => {
              const stat = stats.find((row) => row.consent_key === item.key);
              return (
                <tr key={item.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 font-mono text-[11px]">{item.key}</td>
                  <td className="px-4 py-3">{item.title}</td>
                  <td className="px-4 py-3">{item.published_version?.version_label ?? "—"}</td>
                  <td className="px-4 py-3">{stat?.acceptance_count ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <div className="space-y-3 rounded-[var(--radius-card)] border border-border p-4">
          <h3 className="text-caption font-semibold text-foreground">Create draft version</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Consent key
              <Input value={draftKey} onChange={(event) => setDraftKey(event.target.value)} list="consent-keys" />
              <datalist id="consent-keys">
                {definitions.map((item) => (
                  <option key={item.id} value={item.key} />
                ))}
              </datalist>
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Version label
              <Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="v2" />
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground md:col-span-2">
              Summary (checkbox copy)
              <Input value={summaryText} onChange={(event) => setSummaryText(event.target.value)} />
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground md:col-span-2">
              Document URL
              <Input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} />
            </label>
          </div>
          <Button type="button" disabled={saving || !versionLabel.trim() || !draftKey} onClick={() => void handleCreateDraft()}>
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Publish drafts via the Admin actions queue (maker-checker) or set use_maker_checker=false on the publish API in lower environments.
          </p>
        </div>
      ) : null}
    </div>
  );
}
