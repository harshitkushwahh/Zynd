import { formatTicketTopicLabel } from "@/lib/support-ticket-display";
import type {
  SupportOverviewCategorySegment,
  SupportOverviewTrendPoint,
} from "@/lib/support-overview-analytics-data";
import type { SupportTicket } from "@/lib/support-types";
import { filterTicketsForAgentQueue, summarizeAgentTicketQueue } from "@/lib/support-overview-ticket-stats";

const CHART_FILLS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

export type SupportOverviewPerformance = {
  sla: {
    compliancePct: number;
    resolvedWithinSla: number;
    breachedSla: number;
  };
  firstResponse: { label: string; trendPct: number | null };
  avgResolution: { label: string; trendPct: number | null };
  avgUrgency: { label: string; trendPct: number | null };
};

export type SupportOverviewMetricsBundle = {
  summary: ReturnType<typeof summarizeAgentTicketQueue>;
  trends: SupportOverviewTrendPoint[];
  categories: SupportOverviewCategorySegment[];
  performance: SupportOverviewPerformance;
  metricTrends: {
    total: number | null;
    open: number | null;
    inProgress: number | null;
    resolved: number | null;
  };
  sparklines: {
    total: number[];
    open: number[];
    inProgress: number[];
    resolved: number[];
  };
};

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function weekOverWeekTrend(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function minutesBetween(startIso: string, endIso: string): number | null {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 60_000;
}

export function formatSupportDurationMinutes(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return "NA";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function ticketResolvedAt(ticket: SupportTicket): Date | null {
  const iso = ticket.resolvedAt ?? ticket.sla?.resolvedAt;
  if (!iso) {
    if (ticket.status !== "resolved") return null;
    return new Date(ticket.updatedAt);
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function wasActiveInHumanQueueAt(ticket: SupportTicket, moment: Date): boolean {
  const created = new Date(ticket.createdAt).getTime();
  if (created > moment.getTime()) return false;
  const resolved = ticketResolvedAt(ticket);
  if (resolved && resolved.getTime() <= moment.getTime()) return false;
  return true;
}

function countByStatusAt(tickets: SupportTicket[], moment: Date, status: SupportTicket["status"]): number {
  return tickets.filter(
    (ticket) => ticket.status === status && wasActiveInHumanQueueAt(ticket, moment),
  ).length;
}

function countResolvedOnDay(tickets: SupportTicket[], day: Date): number {
  return tickets.filter((ticket) => {
    const resolved = ticketResolvedAt(ticket);
    return resolved != null && isSameLocalDay(resolved, day);
  }).length;
}

function buildWeeklyTrends(tickets: SupportTicket[]): SupportOverviewTrendPoint[] {
  const today = new Date();
  const points: SupportOverviewTrendPoint[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    const end = endOfLocalDay(day);
    points.push({
      day: day.toLocaleDateString(undefined, { weekday: "short" }),
      open: countByStatusAt(tickets, end, "open"),
      inProgress: countByStatusAt(tickets, end, "pending"),
      resolved: countResolvedOnDay(tickets, day),
    });
  }

  return points;
}

function buildCategorySegments(tickets: SupportTicket[]): SupportOverviewCategorySegment[] {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    const label = formatTicketTopicLabel(ticket.topic);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.map(([label, count], index) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    count,
    fill: CHART_FILLS[index % CHART_FILLS.length]!,
  }));
}

function isTicketSlaBreached(ticket: SupportTicket): boolean {
  const sla = ticket.sla;
  if (!sla) return false;
  if (ticket.status === "resolved") return !sla.resolutionMet;
  if (
    sla.firstResponseRemainingHours != null &&
    sla.firstResponseRemainingHours <= 0 &&
    !sla.firstResponseMet
  ) {
    return true;
  }
  if (sla.resolutionRemainingHours != null && sla.resolutionRemainingHours <= 0 && !sla.resolutionMet) {
    return true;
  }
  return false;
}

function averageMinutes(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ticketsInRange(tickets: SupportTicket[], start: Date, end: Date): SupportTicket[] {
  return tickets.filter((ticket) => {
    const created = new Date(ticket.createdAt).getTime();
    return created >= start.getTime() && created <= end.getTime();
  });
}

function buildPerformance(tickets: SupportTicket[]): SupportOverviewPerformance {
  const resolved = tickets.filter((ticket) => ticket.status === "resolved");
  const resolvedWithinSla = resolved.filter((ticket) => ticket.sla?.resolutionMet !== false).length;
  const breachedSla = tickets.filter(isTicketSlaBreached).length;
  const compliancePct =
    resolved.length === 0 ? 0 : Math.round((resolvedWithinSla / resolved.length) * 100);

  const firstResponseMinutes = tickets
    .map((ticket) => {
      const responded = ticket.firstRespondedAt ?? ticket.sla?.firstRespondedAt;
      if (!responded) return null;
      return minutesBetween(ticket.createdAt, responded);
    })
    .filter((value): value is number => value != null);

  const resolutionMinutes = resolved
    .map((ticket) => {
      const resolvedAt = ticket.resolvedAt ?? ticket.sla?.resolvedAt ?? ticket.updatedAt;
      return minutesBetween(ticket.createdAt, resolvedAt);
    })
    .filter((value): value is number => value != null);

  const now = new Date();
  const thisWeekStart = startOfLocalDay(new Date(now));
  thisWeekStart.setDate(thisWeekStart.getDate() - 6);
  const prevWeekStart = new Date(thisWeekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = endOfLocalDay(new Date(thisWeekStart));
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);

  const firstThisWeek = ticketsInRange(tickets, thisWeekStart, endOfLocalDay(now));
  const firstPrevWeek = ticketsInRange(tickets, prevWeekStart, prevWeekEnd);

  const avgFirstThis = averageMinutes(
    firstThisWeek
      .map((ticket) => {
        const responded = ticket.firstRespondedAt ?? ticket.sla?.firstRespondedAt;
        return responded ? minutesBetween(ticket.createdAt, responded) : null;
      })
      .filter((value): value is number => value != null),
  );
  const avgFirstPrev = averageMinutes(
    firstPrevWeek
      .map((ticket) => {
        const responded = ticket.firstRespondedAt ?? ticket.sla?.firstRespondedAt;
        return responded ? minutesBetween(ticket.createdAt, responded) : null;
      })
      .filter((value): value is number => value != null),
  );

  const avgResThis = averageMinutes(
    firstThisWeek
      .filter((ticket) => ticket.status === "resolved")
      .map((ticket) => minutesBetween(ticket.createdAt, ticket.resolvedAt ?? ticket.updatedAt))
      .filter((value): value is number => value != null),
  );
  const avgResPrev = averageMinutes(
    firstPrevWeek
      .filter((ticket) => ticket.status === "resolved")
      .map((ticket) => minutesBetween(ticket.createdAt, ticket.resolvedAt ?? ticket.updatedAt))
      .filter((value): value is number => value != null),
  );

  const openTickets = tickets.filter((ticket) => ticket.status !== "resolved");
  const urgencyValues = openTickets
    .map((ticket) => ticket.urgencyScore ?? ticket.routing?.urgencyScore ?? null)
    .filter((value): value is number => value != null);
  const avgUrgency =
    urgencyValues.length === 0
      ? null
      : Math.round(urgencyValues.reduce((sum, value) => sum + value, 0) / urgencyValues.length);

  const urgencyPrev = firstPrevWeek
    .filter((ticket) => ticket.status !== "resolved")
    .map((ticket) => ticket.urgencyScore ?? ticket.routing?.urgencyScore ?? null)
    .filter((value): value is number => value != null);
  const avgUrgencyPrev =
    urgencyPrev.length === 0
      ? null
      : Math.round(urgencyPrev.reduce((sum, value) => sum + value, 0) / urgencyPrev.length);

  return {
    sla: { compliancePct, resolvedWithinSla, breachedSla },
    firstResponse: {
      label: formatSupportDurationMinutes(averageMinutes(firstResponseMinutes)),
      trendPct:
        avgFirstThis != null && avgFirstPrev != null
          ? weekOverWeekTrend(Math.round(avgFirstThis), Math.round(avgFirstPrev))
          : null,
    },
    avgResolution: {
      label: formatSupportDurationMinutes(averageMinutes(resolutionMinutes)),
      trendPct:
        avgResThis != null && avgResPrev != null
          ? weekOverWeekTrend(Math.round(avgResThis), Math.round(avgResPrev))
          : null,
    },
    avgUrgency: {
      label: avgUrgency == null ? "NA" : `${avgUrgency}`,
      trendPct:
        avgUrgency != null && avgUrgencyPrev != null
          ? weekOverWeekTrend(avgUrgency, avgUrgencyPrev)
          : null,
    },
  };
}

function buildSparklines(tickets: SupportTicket[]): SupportOverviewMetricsBundle["sparklines"] {
  const today = new Date();
  const days: Date[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    days.push(endOfLocalDay(day));
  }

  return {
    total: days.map((end) => tickets.filter((ticket) => wasActiveInHumanQueueAt(ticket, end)).length),
    open: days.map((end) => countByStatusAt(tickets, end, "open")),
    inProgress: days.map((end) => countByStatusAt(tickets, end, "pending")),
    resolved: days.map((day, index) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - index));
      return countResolvedOnDay(tickets, d);
    }),
  };
}

function buildMetricTrends(tickets: SupportTicket[]): SupportOverviewMetricsBundle["metricTrends"] {
  const now = new Date();
  const thisWeekStart = startOfLocalDay(new Date(now));
  thisWeekStart.setDate(thisWeekStart.getDate() - 6);
  const prevWeekStart = new Date(thisWeekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = endOfLocalDay(new Date(thisWeekStart));
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);

  const createdThisWeek = ticketsInRange(tickets, thisWeekStart, endOfLocalDay(now));
  const createdPrevWeek = ticketsInRange(tickets, prevWeekStart, prevWeekEnd);

  const openThis = createdThisWeek.filter((ticket) => ticket.status === "open").length;
  const openPrev = createdPrevWeek.filter((ticket) => ticket.status === "open").length;
  const pendingThis = createdThisWeek.filter((ticket) => ticket.status === "pending").length;
  const pendingPrev = createdPrevWeek.filter((ticket) => ticket.status === "pending").length;
  const resolvedThis = createdThisWeek.filter((ticket) => ticket.status === "resolved").length;
  const resolvedPrev = createdPrevWeek.filter((ticket) => ticket.status === "resolved").length;

  return {
    total: weekOverWeekTrend(createdThisWeek.length, createdPrevWeek.length),
    open: weekOverWeekTrend(openThis, openPrev),
    inProgress: weekOverWeekTrend(pendingThis, pendingPrev),
    resolved: weekOverWeekTrend(resolvedThis, resolvedPrev),
  };
}

export function buildSupportOverviewAnalytics(
  allTickets: SupportTicket[],
  agentId?: string | null,
): SupportOverviewMetricsBundle {
  const tickets = filterTicketsForAgentQueue(allTickets, agentId);
  const summary = summarizeAgentTicketQueue(tickets);

  return {
    summary,
    trends: buildWeeklyTrends(tickets),
    categories: buildCategorySegments(tickets),
    performance: buildPerformance(tickets),
    metricTrends: buildMetricTrends(tickets),
    sparklines: buildSparklines(tickets),
  };
}
