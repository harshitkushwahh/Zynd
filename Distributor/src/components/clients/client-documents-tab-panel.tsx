"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { FileCheck2, FileText, FileWarning, IdCard, Landmark, PenLine, FileSignature } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { ClientDetailEmptyState } from "@/components/clients/client-detail-empty-state";
import { ClientDocumentViewDialog } from "@/components/clients/client-document-view-dialog";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildClientDocumentsForInvestor } from "@/lib/client-documents";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import type {
  DistributorClientDocument,
  DistributorClientDocumentStatus,
  DistributorClientProfile,
} from "@/lib/dummy/types";
import { env } from "@/lib/env";
import { formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";

const HIDDEN_DOCUMENT_CATEGORIES = new Set<DistributorClientDocument["category"]>([
  "esign",
  "kyc_form",
]);

const STATUS_OPTIONS: Array<{ value: DistributorClientDocumentStatus; label: string }> = [
  { value: "uploaded", label: "Uploaded" },
  { value: "missing", label: "Missing" },
  { value: "not_required", label: "Not required" },
];

const CATEGORY_ICONS: Record<DistributorClientDocument["category"], LucideIcon> = {
  pan: IdCard,
  address_proof: FileText,
  bank_proof: Landmark,
  signature: PenLine,
  esign: FileSignature,
  kyc_form: FileCheck2,
};

type ClientDocumentsTabPanelProps = {
  profile: DistributorClientProfile;
};

function resolveDocuments(profile: DistributorClientProfile): DistributorClientDocument[] {
  let docs: DistributorClientDocument[];
  if (env.useBackendClients && profile.clientDocuments.length > 0) {
    docs = profile.clientDocuments;
  } else if (profile.clientDocuments.length > 0) {
    docs = profile.clientDocuments;
  } else {
    docs = buildClientDocumentsForInvestor(profile.investor, profile.kycSteps);
  }
  return docs.filter((doc) => !HIDDEN_DOCUMENT_CATEGORIES.has(doc.category));
}

function statusLabel(
  status: DistributorClientDocumentStatus,
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["documents"],
): string {
  if (status === "uploaded") return copy.statusUploaded;
  if (status === "not_required") return copy.statusNotRequired;
  return copy.statusMissing;
}

function statusVariant(status: DistributorClientDocumentStatus): "success" | "warning" | "neutral" {
  if (status === "uploaded") return "success";
  if (status === "missing") return "warning";
  return "neutral";
}

export function ClientDocumentsTabPanel({ profile }: ClientDocumentsTabPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.documents;
  const documents = useMemo(() => resolveDocuments(profile), [profile]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DistributorClientDocumentStatus | "all">("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "label",
    direction: "ascending",
  });
  const [viewDocument, setViewDocument] = useState<DistributorClientDocument | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (statusFilter !== "all" && doc.status !== statusFilter) return false;
      return distributorTableSearchMatch(
        search,
        doc.label,
        doc.fileName ?? "",
        doc.identifierMasked ?? "",
        doc.source,
        statusLabel(doc.status, copy),
      );
    });
  }, [copy, documents, search, statusFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  if (documents.length === 0) {
    return <ClientDetailEmptyState message={copy.empty} icon={FileWarning} />;
  }

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearch("");
        setStatusFilter("all");
        setPage(1);
      }}
      clearDisabled={search.trim() === "" && statusFilter === "all"}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
        />
      }
    >
      <StatusFilterSelect
        label={copy.statusFilterLabel}
        value={statusFilter}
        options={STATUS_OPTIONS}
        onValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label={copy.tableTitle}
      className="min-w-[var(--table-min-width-2xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="label" label={copy.columnDocument} isRowHeader allowsSorting />
        <Table.Head id="identifierMasked" label={copy.columnIdentifier} allowsSorting />
        <Table.Head id="fileName" label={copy.columnFile} allowsSorting />
        <Table.Head
          id="uploadedAt"
          label={copy.columnUploaded}
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
        <Table.Head id="status" label={copy.columnStatus} allowsSorting />
        <Table.Head id="source" label={copy.columnSource} allowsSorting />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(doc) => {
          const Icon = CATEGORY_ICONS[doc.category];
          return (
            <Table.Row
              id={doc.id}
              className="cursor-pointer distributor-client-documents-table-row--link"
              onAction={() => {
                setViewDocument(doc);
                setViewOpen(true);
              }}
            >
              <Table.Cell>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/50 text-muted-foreground"
                    aria-hidden
                  >
                    <Icon className="size-3.5" strokeWidth={2.25} />
                  </span>
                  <span className="truncate font-medium text-foreground">{doc.label}</span>
                </div>
              </Table.Cell>
              <Table.Cell className="font-mono text-caption text-muted-foreground">
                {doc.identifierMasked ?? copy.identifierNone}
              </Table.Cell>
              <Table.Cell className="max-w-[14rem] truncate text-muted-foreground">
                {doc.fileName ?? copy.fileNone}
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap tabular-nums text-muted-foreground">
                {doc.uploadedAt ? formatDistributorDate(doc.uploadedAt) : copy.dateNone}
              </Table.Cell>
              <Table.Cell>
                <StatusBadge variant={statusVariant(doc.status)}>
                  {statusLabel(doc.status, copy)}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap text-muted-foreground">{doc.source}</Table.Cell>
            </Table.Row>
          );
        }}
      </Table.Body>
    </Table>,
  );

  return (
    <>
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle={copy.emptyFiltered}
        emptyDescription={DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription}
      >
        {table}
      </DistributorTableOnlyShell>
      <ClientDocumentViewDialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) setViewDocument(null);
        }}
        document={viewDocument}
        statusLabel={(status) => statusLabel(status, copy)}
        statusVariant={statusVariant}
      />
    </>
  );
}
