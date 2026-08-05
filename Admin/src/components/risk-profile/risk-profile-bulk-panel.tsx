"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { FileSpreadsheet, Info, RotateCcw, Search } from "lucide-react";

import { AdminFormDialog, AdminInfoDialog } from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  previewRiskBulkImport,
  RISK_BULK_SAMPLE_CSV,
  submitRiskBulkImport,
  type RiskBulkPreview,
} from "@/lib/risk-profile-admin-api";

function countCsvRows(csv: string) {
  const lines = csv
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return Math.max(0, lines.length - 1);
}

type RiskProfileBulkImportContextValue = {
  openInfo: () => void;
  openEditor: () => void;
  feedback: ReactNode;
};

const RiskProfileBulkImportContext = createContext<RiskProfileBulkImportContextValue | null>(null);

function BulkCsvPreviewPanel({
  loading,
  rowCount,
  preview,
}: {
  loading: boolean;
  rowCount: number;
  preview: RiskBulkPreview | null;
}) {
  const validCount = preview?.valid_count ?? 0;
  const errorCount = preview?.error_count ?? 0;

  return (
    <div className="flex min-h-[22rem] flex-col rounded-[var(--radius-card)] border border-border bg-muted/15">
      <div className="border-b border-border px-4 py-3">
        <p className="text-compact font-semibold text-foreground">Preview</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-[var(--radius-control)] border border-border bg-background px-2.5 py-1 text-caption text-muted-foreground">
            Rows <span className="ml-1 font-semibold tabular-nums text-foreground">{rowCount}</span>
          </span>
          <span className="rounded-[var(--radius-control)] border border-border bg-background px-2.5 py-1 text-caption text-muted-foreground">
            Valid <span className="ml-1 font-semibold tabular-nums text-foreground">{validCount}</span>
          </span>
          <span
            className={cn(
              "rounded-[var(--radius-control)] border border-border bg-background px-2.5 py-1 text-caption text-muted-foreground",
              errorCount > 0 && "border-warning/30 bg-warning/5 text-warning",
            )}
          >
            Errors <span className="ml-1 font-semibold tabular-nums">{errorCount}</span>
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-caption text-muted-foreground">Validating CSV…</p>
          </div>
        ) : preview ? (
          preview.errors.length ? (
            <div className="space-y-2">
              {preview.errors.map((item) => (
                <p key={`${item.line}-${item.code}`} className="text-caption leading-relaxed text-destructive">
                  Line {item.line}: {item.message}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-caption text-muted-foreground">
              {preview.ready
                ? "All rows passed validation. You can import now."
                : "No valid rows to import."}
            </p>
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 flex size-11 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
              <Search className="size-5" strokeWidth={2} />
            </div>
            <p className="max-w-[14rem] text-caption leading-relaxed text-muted-foreground">
              Run Preview to validate rows and see errors here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function RiskProfileBulkImportRoot({
  canManage,
  onImportComplete,
  children,
}: {
  canManage: boolean;
  onImportComplete?: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [csv, setCsv] = useState(RISK_BULK_SAMPLE_CSV);
  const [preview, setPreview] = useState<RiskBulkPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const rowCount = useMemo(() => countCsvRows(csv), [csv]);

  const handlePreview = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await previewRiskBulkImport({ csv });
      setPreview(result);
      setMessage(`Validated ${result.valid_count} of ${result.row_count} rows.`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not preview CSV."));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canManage) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await submitRiskBulkImport({ csv });
      setMessage(`Imported ${result.created_questions} question(s).`);
      setDialogOpen(false);
      setPreview(null);
      await onImportComplete?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not import CSV."));
    } finally {
      setLoading(false);
    }
  };

  const feedback = (
    <>
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}
    </>
  );

  const contextValue: RiskProfileBulkImportContextValue = {
    openInfo: () => setInfoOpen(true),
    openEditor: () => setDialogOpen(true),
    feedback,
  };

  return (
    <RiskProfileBulkImportContext.Provider value={contextValue}>
      {children}

      <AdminInfoDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Bulk CSV reference"
        description="Paste or upload rows with the header line included."
        icon={Info}
        iconTone="info"
        size="md"
      >
        <div className="space-y-4 text-compact">
          <p className="font-medium text-foreground">Required columns</p>
          <p className="font-mono text-caption text-muted-foreground">
            category_slug, question_prompt, option_1, option_1_score, option_2, option_2_score, option_3,
            option_3_score, option_4, option_4_score, help_text, sort_order
          </p>
          <p className="text-muted-foreground">
            Up to four options per row. Scores must be integers from 0 to 100. Each category_slug must
            already exist in Categories before you import questions.
          </p>
        </div>
      </AdminInfoDialog>

      <AdminFormDialog
        open={dialogOpen}
        onClose={() => !loading && setDialogOpen(false)}
        title="Bulk CSV editor"
        description="Paste CSV on the left and preview validation on the right."
        icon={FileSpreadsheet}
        iconTone="info"
        size="xl"
        contentClassName="max-w-6xl"
        bodyClassName="py-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="outline" disabled={loading || !csv.trim()} onClick={() => void handlePreview()}>
              <Search className="size-3.5" />
              Preview
            </Button>
            <Button disabled={loading || !canManage || !preview?.ready} onClick={() => void handleSubmit()}>
              Import
            </Button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="flex min-h-[22rem] flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="risk-bulk-csv">CSV data</Label>
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setCsv(RISK_BULK_SAMPLE_CSV);
                  setPreview(null);
                }}
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>
            <textarea
              id="risk-bulk-csv"
              className="min-h-0 flex-1 rounded-[var(--radius-control)] border border-input bg-transparent px-3 py-2 font-mono text-caption leading-relaxed"
              value={csv}
              onChange={(event) => {
                setCsv(event.target.value);
                setPreview(null);
              }}
            />
          </div>

          <BulkCsvPreviewPanel loading={loading} rowCount={rowCount} preview={preview} />
        </div>
      </AdminFormDialog>
    </RiskProfileBulkImportContext.Provider>
  );
}

export function RiskProfileBulkImportActions() {
  const context = useContext(RiskProfileBulkImportContext);
  if (!context) return null;

  return (
    <>
      <Button variant="outline" size="icon-sm" onClick={context.openInfo} aria-label="CSV reference">
        <Info className="size-3.5" />
      </Button>
      <Button size="sm" variant="outline" onClick={context.openEditor}>
        Open CSV import
      </Button>
    </>
  );
}

export function RiskProfileBulkImportFeedback() {
  const context = useContext(RiskProfileBulkImportContext);
  if (!context) return null;
  return context.feedback;
}
