"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Webhook } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { MfStatusChip } from "@/components/mf/mf-status-chip";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfTransactionWebhooks,
  replayMfTransactionWebhook,
  type MfTransactionWebhookEvent,
} from "@/lib/mf-transactions-admin-api";

const ALL = "all";


function webhookTone(status: string) {
  if (status === "failed") return "danger" as const;
  if (status === "processed") return "success" as const;
  if (status === "pending") return "warning" as const;
  return "neutral" as const;
}

export function MfTransactionWebhooksPanel({
  canRead,
  canManage,
}: {
  canRead: boolean;
  canManage: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<MfTransactionWebhookEvent[]>([]);
  const [webhookStatusFilter, setWebhookStatusFilter] = useState("failed");
  const [webhookPage, setWebhookPage] = useState(0);

  const loadData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchMfTransactionWebhooks({
        processing_status: webhookStatusFilter === ALL ? undefined : webhookStatusFilter,
        limit: 50,
      });
      setWebhooks(result.events);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load webhooks."));
    } finally {
      setLoading(false);
    }
  }, [canRead, webhookStatusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setWebhookPage(0);
  }, [webhookStatusFilter]);

  const webhookPagination = useMemo(
    () => paginateItems(webhooks, webhookPage, ADMIN_TABLE_PAGE_SIZE),
    [webhookPage, webhooks],
  );

  const handleReplayWebhook = async (eventId: number) => {
    if (!canManage) return;
    setActionLoading(`replay-${eventId}`);
    setMessage("");
    try {
      await replayMfTransactionWebhook(eventId);
      setMessage(`Webhook ${eventId} replayed.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not replay webhook."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSectionTitle icon={Webhook}>Webhook events</AdminSectionTitle>
        <Select
          value={webhookStatusFilter}
          onValueChange={(value) => setWebhookStatusFilter(value ?? ALL)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses">
              {webhookStatusFilter === ALL ? "All statuses" : webhookStatusFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="failed">failed</SelectItem>
            <SelectItem value="processed">processed</SelectItem>
            <SelectItem value="ignored">ignored</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminDataTable minWidth="xl">
        <AdminTableHeader>
          <tr>
            {canManage ? <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell> : null}
            <AdminTableHeadCell>Event</AdminTableHeadCell>
            <AdminTableHeadCell>Type</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Received</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={canManage ? 5 : 4} />
          ) : webhookPagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={canManage ? 5 : 4}>No webhook events found.</AdminTableStateRow>
          ) : (
            webhookPagination.items.map((event, index) => (
              <AdminTableRow key={event.event_id ?? `webhook-${index}`}>
                {canManage ? (
                  <AdminTableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === `replay-${event.event_id}`}
                      onClick={() => void handleReplayWebhook(event.event_id)}
                    >
                      Replay
                    </Button>
                  </AdminTableCell>
                ) : null}
                <AdminTableCell>
                  <p className="font-medium text-foreground">#{event.event_id}</p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {event.fp_event_id ?? "No data"}
                  </p>
                </AdminTableCell>
                <AdminTableCell>{event.event_type}</AdminTableCell>
                <AdminTableCell>
                  <MfStatusChip
                    label={event.processing_status}
                    tone={webhookTone(event.processing_status)}
                    showIcon={false}
                  />
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {event.received_at ? new Date(event.received_at).toLocaleString() : "No data"}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      {!loading && webhooks.length > 0 ? (
        <AdminTablePagination
          page={webhookPagination.page}
          totalPages={webhookPagination.totalPages}
          hasPrevious={webhookPagination.hasPrevious}
          hasNext={webhookPagination.hasNext}
          disabled={loading}
          onPrevious={() => setWebhookPage((page) => Math.max(0, page - 1))}
          onNext={() => setWebhookPage((page) => page + 1)}
        />
      ) : null}
    </div>
  );
}
