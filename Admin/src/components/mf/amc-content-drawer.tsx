"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfAmcContent,
  updateMfAmcContent,
  type MfAmcContent,
} from "@/lib/mf-admin-api";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function AmcContentDrawer({
  amcId,
  amcName,
  canManage,
  onClose,
}: {
  amcId: number;
  amcName: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const [content, setContent] = useState<MfAmcContent | null>(null);
  const [marketingName, setMarketingName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMfAmcContent(amcId)
      .then((data) => {
        setContent(data);
        setMarketingName(data.content.marketing_name ?? "");
        setDescription(data.content.description ?? "");
        setWebsiteUrl(data.content.website_url ?? "");
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load AMC content.")))
      .finally(() => setLoading(false));
  }, [amcId]);

  const handleSave = async () => {
    if (!canManage) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateMfAmcContent(amcId, {
        marketing_name: marketingName,
        description,
        website_url: websiteUrl,
      });
      setContent(updated);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save AMC content."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <button type="button" className="flex-1" aria-label="Close AMC content drawer" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-zynd-high">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-caption text-muted-foreground">AMC content</p>
            <h2 className="font-heading text-h4 font-semibold text-foreground">{amcName}</h2>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="size-3.5" />
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <p className="text-compact text-muted-foreground">Loading…</p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Marketing profile</CardTitle>
                <CardDescription>Shown on fund detail via invest API merge.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {error ? <p className="text-compact text-destructive">{error}</p> : null}
                <label className="block space-y-1 text-compact">
                  <span className="text-muted-foreground">Marketing name</span>
                  <Input value={marketingName} onChange={(e) => setMarketingName(e.target.value)} disabled={!canManage} />
                </label>
                <label className="block space-y-1 text-compact">
                  <span className="text-muted-foreground">Description</span>
                  <textarea
                    className="min-h-[120px] w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 text-compact"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canManage}
                  />
                </label>
                <label className="block space-y-1 text-compact">
                  <span className="text-muted-foreground">Website URL</span>
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} disabled={!canManage} />
                </label>
                {content?.content.updated_at ? (
                  <p className="text-caption text-muted-foreground">
                    Updated {new Date(content.content.updated_at).toLocaleString()}
                  </p>
                ) : null}
                {canManage ? (
                  <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
                    {saving ? "Saving…" : "Save AMC content"}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </aside>
    </div>
  );
}
