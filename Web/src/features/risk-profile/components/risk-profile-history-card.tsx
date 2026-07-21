"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Download, Loader2, Lock } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { RiskTierBadge } from "@/features/risk-profile/components/risk-tier-badge";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import { RiskProfileDetailDialog } from "@/features/risk-profile/components/risk-profile-detail-dialog";
import {
  preloadRiskProfileGauge,
  RiskProfileGauge,
} from "@/features/risk-profile/components/risk-profile-gauge";
import { downloadRiskProfilePdf } from "@/features/risk-profile/lib/risk-profile-pdf-download";
import {
  RISK_PROFILE_CARD_CLASS,
  RISK_PROFILE_HISTORY_PLACEHOLDER_ROWS,
  resolveRiskTierVisual,
  type RiskProfileHistoryRow,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type RiskProfileHistoryCardProps = {
  rows: RiskProfileHistoryRow[];
  hasProfile: boolean;
};

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function QuestionsProgressInline({
  answered,
  total,
}: {
  answered: number;
  total: number;
}) {
  const progress = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;

  return (
    <div className="flex min-w-0 items-center justify-center gap-2 px-1">
      <div className="h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {copy.riskProfile.historyQuestionsScore(answered, total)}
      </span>
    </div>
  );
}

function HistoryLockPanel() {
  return (
    <div className="flex w-full max-w-[18rem] items-center gap-3 px-3.5 py-2.5 shadow-zynd-mid backdrop-blur-sm sm:px-4 sm:py-3 sip-lock-panel">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="size-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-compact font-semibold text-foreground">{copy.riskProfile.lockedGaugeTitle}</p>
        <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
          {copy.riskProfile.lockedGaugeDescription}
        </p>
      </div>
    </div>
  );
}

function RiskProfileHistoryRowItem({
  row,
  onSelect,
  isLocked,
  downloadingId,
  onDownload,
}: {
  row: RiskProfileHistoryRow;
  onSelect: (row: RiskProfileHistoryRow) => void;
  isLocked: boolean;
  downloadingId: string | null;
  onDownload: (row: RiskProfileHistoryRow) => void;
}) {
  const tierVisual = resolveRiskTierVisual(row.tier);
  const displayScore = row.displayScore;
  const isDownloading = downloadingId === row.id;

  const handleOpenDetail = () => {
    if (isLocked) return;
    onSelect(row);
  };

  return (
    <div
      role={isLocked ? undefined : "button"}
      tabIndex={isLocked ? undefined : 0}
      onClick={isLocked ? undefined : handleOpenDetail}
      onKeyDown={
        isLocked
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenDetail();
              }
            }
      }
      className={cn(
        "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-[var(--radius-control)] px-2 py-2.5 transition-colors",
        "border-b border-border/60 last:border-0",
        !isLocked && "cursor-pointer hover:bg-muted",
      )}
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
        <RiskProfileGauge score={row.score} displayScore={row.displayScore} tier={row.tier} mini />

        <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5">
          <RiskTierBadge tier={row.tier} className="max-w-full tracking-wide" />
          <StatusBadge variant="neutral" showIcon={false} className={cn("shrink-0 tabular-nums", tierVisual.textClass)}>
            {displayScore}/100
          </StatusBadge>
        </div>

        <QuestionsProgressInline answered={row.questionsAnswered} total={row.totalQuestions} />

        <div className="flex min-w-0 items-center justify-center">
          <StatusBadge variant="neutral" showIcon={false} className="max-w-full">
            {formatHistoryDate(row.date)}
          </StatusBadge>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          disabled={isLocked || isDownloading}
          className="flex size-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors enabled:hover:bg-background enabled:hover:text-foreground disabled:opacity-50"
          aria-label={copy.riskProfile.historyDownloadPdfAria}
          onClick={(event) => {
            event.stopPropagation();
            onDownload(row);
          }}
        >
          {isDownloading ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          ) : (
            <Download className="size-4" strokeWidth={2.25} />
          )}
        </button>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors",
            !isLocked && "group-hover:text-foreground",
          )}
          aria-hidden
        >
          <ChevronRight className="size-4" strokeWidth={2.25} />
        </span>
      </div>
    </div>
  );
}

export function RiskProfileHistoryCard({ rows, hasProfile }: RiskProfileHistoryCardProps) {
  const riskProfile = useRiskProfileOptional();
  const isLocked = !hasProfile;
  const displayRows = isLocked ? RISK_PROFILE_HISTORY_PLACEHOLDER_ROWS : rows;
  const completedCount = riskProfile?.attemptState?.completed_count ?? rows.length;
  const totalAttempts = riskProfile?.attemptState?.granted_attempts ?? 0;
  const [selectedRow, setSelectedRow] = useState<RiskProfileHistoryRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    void preloadRiskProfileGauge();
  }, []);

  const handleDownload = (row: RiskProfileHistoryRow) => {
    setDownloadingId(row.id);
    void downloadRiskProfilePdf(row.id).finally(() => setDownloadingId(null));
  };

  const handleSelectRow = (row: RiskProfileHistoryRow) => {
    if (isLocked) return;
    setSelectedRow(row);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedRow(null);
    }
  };

  return (
    <>
      <section className={cn(RISK_PROFILE_CARD_CLASS, "p-4 sm:p-5")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-compact font-semibold text-foreground sm:text-body">{copy.riskProfile.historyTitle}</h2>
          {!isLocked && totalAttempts > 0 ? (
            <span aria-label={copy.riskProfile.historyTotalCountAria(completedCount, totalAttempts)}>
              <StatusBadge
                variant="neutral"
                showIcon={false}
                className="h-6 shrink-0 px-2.5 text-[11px] tabular-nums sm:text-caption"
              >
                {copy.riskProfile.historyTotalCountLabel(completedCount, totalAttempts)}
              </StatusBadge>
            </span>
          ) : null}
        </div>

        <div className="relative mt-3">
          <div
            className={cn(
              "max-h-[calc(2*4.75rem+2px)] overflow-y-auto overscroll-y-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
              isLocked && "pointer-events-none select-none overflow-hidden",
            )}
          >
            <div className={cn(isLocked && "blur-[4px]")}>
              {!isLocked && displayRows.length === 0 ? (
                <p className="px-2 py-6 text-center text-compact text-muted-foreground">
                  {copy.riskProfile.historyEmpty}
                </p>
              ) : (
                displayRows.map((row) => (
                  <RiskProfileHistoryRowItem
                    key={row.id}
                    row={row}
                    onSelect={handleSelectRow}
                    isLocked={isLocked}
                    downloadingId={downloadingId}
                    onDownload={handleDownload}
                  />
                ))
              )}
            </div>
          </div>

          {isLocked ? (
            <>
              <div className="pointer-events-none absolute inset-0 risk-profile-gauge-overlay" aria-hidden />
              <div className="absolute inset-0 flex items-center justify-center px-3">
                <HistoryLockPanel />
              </div>
            </>
          ) : null}
        </div>
      </section>

      <RiskProfileDetailDialog
        open={selectedRow !== null}
        onOpenChange={handleDialogOpenChange}
        row={selectedRow}
      />
    </>
  );
}
