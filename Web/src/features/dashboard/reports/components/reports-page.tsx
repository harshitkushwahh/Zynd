"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileBarChart, FolderOpen, Play, Search } from "lucide-react";
import Image from "next/image";

import { Table, TableCard } from "@/components/core/table";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { REPORTS_ROUTE } from "@/features/dashboard/navigation/dashboard-routes";
import { downloadInvestorReport } from "@/features/dashboard/reports/lib/investor-report-download";
import { PortfolioDetailLockedSection } from "@/features/dashboard/portfolio/components/portfolio-detail-locked-section";
import { PortfolioTabEmptyState } from "@/features/dashboard/portfolio/components/portfolio-tab-empty-state";
import {
  createInvestorReport,
  fetchInvestorReports,
  type InvestorReport,
  type InvestorReportKind,
} from "@/features/invest/api/invest-api";
import { formatDateTime } from "@/features/invest/lib/mf-format";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ReportKind = InvestorReportKind | "cas";

const REPORT_LABELS: Record<string, string> = {
  account_statement: copy.reports.accountStatementTitle,
  capital_gains: copy.reports.capitalGainsTitle,
  tax: copy.reports.taxReportsTitle,
  cas: copy.reports.casTitle,
};

const REPORT_TYPES: Array<{
  kind: ReportKind;
  title: string;
  body: string;
  imageSrc?: string;
  locked?: boolean;
}> = [
  {
    kind: "account_statement",
    title: copy.reports.accountStatementTitle,
    body: copy.reports.accountStatementBody,
    imageSrc: "/account-stmnt.png",
  },
  {
    kind: "capital_gains",
    title: copy.reports.capitalGainsTitle,
    body: copy.reports.capitalGainsBody,
    imageSrc: "/captal-gains.png",
  },
  {
    kind: "tax",
    title: copy.reports.taxReportsTitle,
    body: copy.reports.taxReportsBody,
    imageSrc: "/taxreports.png",
  },
  {
    kind: "cas",
    title: copy.reports.casTitle,
    body: copy.reports.casBody,
    imageSrc: "/cas.png",
    locked: true,
  },
];

const TABLE_LAYOUT_CLASS = "w-full table-fixed border-collapse border-spacing-0";
const COL_TYPE = "w-[42%]";
const COL_WHEN = "w-[38%]";
const COL_ACTION = "w-[20%]";
const HEADER_ROW_CLASS =
  "sticky top-0 z-10 !h-auto !bg-transparent [&>tr>th]:after:!hidden [&>tr]:border-b [&>tr]:border-border";
const HEADER_CELL_CLASS = "px-4 py-3.5 md:px-5";
const BODY_CELL_CLASS = "px-4 md:px-5";
const HEADER_SURFACE_CLASS = "bg-muted/30";
const HEADER_LABEL_CLASS =
  "[&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-muted-foreground";

function ReportTypeCard({
  title,
  body,
  imageSrc,
  locked,
  generating,
  onRun,
}: {
  title: string;
  body: string;
  imageSrc?: string;
  locked?: boolean;
  generating?: boolean;
  onRun: () => void;
}) {
  const card = (
    <div
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "flex h-full flex-col border border-border/70 bg-card p-5 shadow-zynd-low",
      )}
    >
      {imageSrc ? (
        <div className="relative h-28 w-full max-w-[9.5rem]">
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes="152px"
            quality={70}
            className="object-contain object-left"
          />
        </div>
      ) : (
        <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary">
          <FolderOpen className="size-7" strokeWidth={2} aria-hidden />
        </div>
      )}
      <h2 className="mt-4 text-body font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1.5 flex-1 text-caption leading-relaxed text-muted-foreground">{body}</p>
      <Button type="button" className="mt-4 w-full gap-2" disabled={locked || generating} onClick={onRun}>
        <Play className="size-3.5 fill-current" aria-hidden />
        {generating ? copy.reports.generatingLabel : copy.reports.runLabel}
      </Button>
    </div>
  );

  if (!locked) return card;

  return (
    <PortfolioDetailLockedSection
      title={copy.reports.casLockedTitle}
      subtitle={copy.reports.casLockedDescription}
      className="h-full"
    >
      {card}
    </PortfolioDetailLockedSection>
  );
}

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [runningKind, setRunningKind] = useState<InvestorReportKind | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const reportsQuery = useQuery({
    queryKey: queryKeys.invest.reports(),
    queryFn: fetchInvestorReports,
  });

  const generateMutation = useMutation({
    mutationFn: (kind: InvestorReportKind) => createInvestorReport(kind),
    onMutate: (kind) => {
      setRunningKind(kind);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invest.reports() });
    },
    onError: () => {
      toast.error(copy.reports.runFailed);
    },
    onSettled: () => {
      setRunningKind(null);
    },
  });

  const generated = reportsQuery.data?.reports ?? [];
  const query = search.trim().toLowerCase();
  const visibleGenerated = query
    ? generated.filter((row) => {
        const typeLabel = (REPORT_LABELS[row.kind] ?? row.kind).toLowerCase();
        const when = row.generated_at ? formatDateTime(row.generated_at).toLowerCase() : "";
        return typeLabel.includes(query) || when.includes(query) || row.kind.toLowerCase().includes(query);
      })
    : generated;

  async function handleDownload(row: InvestorReport) {
    setDownloadingId(row.id);
    try {
      await downloadInvestorReport(row.id, row.filename);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <DashboardContentFade className="flex min-h-0 flex-col">
      <DashboardBreadcrumb items={[{ label: copy.reports.pageTitle }]} />
      <PageHeader icon={REPORTS_ROUTE.icon} title={copy.reports.pageTitle} />
      <div className="flex min-h-0 flex-col gap-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {REPORT_TYPES.map((item) => (
            <ReportTypeCard
              key={item.kind}
              title={item.title}
              body={item.body}
              imageSrc={item.imageSrc}
              locked={item.locked}
              generating={item.kind !== "cas" && runningKind === item.kind}
              onRun={() => {
                if (item.kind === "cas") return;
                generateMutation.mutate(item.kind);
              }}
            />
          ))}
        </div>

        {generated.length === 0 ? (
          <PortfolioTabEmptyState
            icon={FileBarChart}
            title={copy.reports.emptyTitle}
            description={copy.reports.emptyDescription}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="px-0.5 text-compact font-semibold text-foreground">{copy.reports.tableTitle}</h2>
              <div className="relative w-full sm:w-[16rem] sm:shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={copy.reports.tableSearchPlaceholder}
                  className="h-8 pl-8"
                  aria-label={copy.reports.tableSearchPlaceholder}
                />
              </div>
            </div>
            <TableCard.Root
              size="sm"
              className={cn(ZYND_3XL_RADIUS_CLASS, "overflow-hidden border-border/60 shadow-zynd-low")}
            >
              <div className="overflow-x-auto overscroll-x-contain">
                {visibleGenerated.length === 0 ? (
                  <p className="px-4 py-8 text-center text-compact text-muted-foreground md:px-5">
                    {copy.reports.tableSearchEmpty}
                  </p>
                ) : (
                  <Table aria-label={copy.reports.tableTitle} size="sm" className={TABLE_LAYOUT_CLASS}>
                    <Table.Header bordered={false} className={HEADER_ROW_CLASS}>
                      <Table.Head
                        id="type"
                        isRowHeader
                        className={cn(COL_TYPE, HEADER_CELL_CLASS, HEADER_SURFACE_CLASS, HEADER_LABEL_CLASS)}
                      >
                        {copy.reports.tableType}
                      </Table.Head>
                      <Table.Head
                        id="generated"
                        className={cn(COL_WHEN, HEADER_CELL_CLASS, HEADER_SURFACE_CLASS, HEADER_LABEL_CLASS)}
                      >
                        {copy.reports.tableGeneratedOn}
                      </Table.Head>
                      <Table.Head
                        id="download"
                        className={cn(
                          COL_ACTION,
                          HEADER_CELL_CLASS,
                          HEADER_SURFACE_CLASS,
                          HEADER_LABEL_CLASS,
                          "[&>div]:w-full [&>div]:justify-center",
                        )}
                      >
                        {copy.reports.tableDownload}
                      </Table.Head>
                    </Table.Header>
                    <Table.Body className="[&>tr:first-child>td]:border-t-0" items={visibleGenerated}>
                      {(row) => (
                        <Table.Row id={row.id}>
                          <Table.Cell className={cn(COL_TYPE, BODY_CELL_CLASS, "font-medium text-foreground")}>
                            <div>{REPORT_LABELS[row.kind] ?? row.kind}</div>
                            {row.status === "failed" && row.error_message ? (
                              <p className="mt-1 text-caption font-normal text-destructive">
                                {copy.reports.failedLabel}: {row.error_message}
                              </p>
                            ) : null}
                          </Table.Cell>
                          <Table.Cell className={cn(COL_WHEN, BODY_CELL_CLASS, "text-muted-foreground tabular-nums")}>
                            {row.generated_at ? formatDateTime(row.generated_at) : "—"}
                          </Table.Cell>
                          <Table.Cell className={cn(COL_ACTION, BODY_CELL_CLASS, "text-center")}>
                            <IconActionButton
                              label={copy.reports.downloadLabel}
                              icon={Download}
                              disabled={!row.downloadable}
                              loading={downloadingId === row.id}
                              onClick={() => void handleDownload(row)}
                            />
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table>
                )}
              </div>
            </TableCard.Root>
          </div>
        )}
      </div>
    </DashboardContentFade>
  );
}