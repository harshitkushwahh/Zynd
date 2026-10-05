"use client";

import { useEffect, useState } from "react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { fetchAdminUserConsentRecords, type AdminUserConsentRecord } from "@/lib/admin-api";
import { useAdminAuth } from "@/contexts/admin-auth-context";

type AdminUserConsentsSectionProps = {
  userId: string;
};

export function AdminUserConsentsSection({ userId }: AdminUserConsentsSectionProps) {
  const { hasPermission } = useAdminAuth();
  const canRead = hasPermission("consents.records.read");
  const [records, setRecords] = useState<AdminUserConsentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canRead || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchAdminUserConsentRecords(userId)
      .then((rows) => {
        if (!cancelled) setRecords(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load consent history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, userId]);

  if (!canRead) return null;

  return (
    <section className="space-y-3 rounded-[var(--radius-card)] border border-border p-4">
      <h3 className="text-caption font-semibold text-foreground">Consent history</h3>
      {loading ? <p className="text-caption text-muted-foreground">Loading…</p> : null}
      {error ? <AdminFeedbackMessage variant="error">{error}</AdminFeedbackMessage> : null}
      {!loading && !error && records.length === 0 ? (
        <p className="text-caption text-muted-foreground">No consent records for this user.</p>
      ) : null}
      {records.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[11px]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Consent</th>
                <th className="py-2 pr-3 font-medium">Version</th>
                <th className="py-2 pr-3 font-medium">Action</th>
                <th className="py-2 pr-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="py-2 pr-3">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{row.consent_title ?? row.consent_key ?? "—"}</td>
                  <td className="py-2 pr-3">{row.version_label ?? "—"}</td>
                  <td className="py-2 pr-3 capitalize">{row.action}</td>
                  <td className="py-2 pr-3">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
