import { apiRequest } from "@/lib/api-client";
import type {
  DistributorJobCompensation,
  DistributorJobPerformanceCalc,
  DistributorLeaveRequest,
  DistributorPayrollPromotion,
  DistributorWorkAttendanceRow,
} from "@/lib/distributor-job-dashboard-data";
import type { DistributorWorkAttendanceConfig } from "@/lib/distributor-work-attendance-config";
import type { DistributorWorkGeolocation } from "@/lib/distributor-work-geolocation";

export type ApiWorkSession = {
  id: string;
  signedInAt: string;
  signedOutAt: string | null;
  workSiteId: "office" | "client-site";
  workModeId: string;
  timeSlotId: string;
  remarks: string | null;
  geolocation: DistributorWorkGeolocation;
  status: "active" | "complete";
  hours: number;
};

export type ApiPayrollDashboard = {
  id: string;
  periodLabel: string;
  compensation: DistributorJobCompensation;
  performance: DistributorJobPerformanceCalc;
  promotion: DistributorPayrollPromotion | null;
};

type ApiWorkConfigResponse = {
  workModes: DistributorWorkAttendanceConfig["workModes"];
  timeSlots: DistributorWorkAttendanceConfig["timeSlots"];
  workSites: DistributorWorkAttendanceConfig["workSites"];
};

function mapApiLeaveRequest(item: {
  id: string;
  type: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: string;
  appliedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}): DistributorLeaveRequest {
  return {
    id: item.id,
    type: item.type as DistributorLeaveRequest["type"],
    fromDate: item.fromDate,
    toDate: item.toDate,
    days: item.days,
    reason: item.reason,
    status: item.status as DistributorLeaveRequest["status"],
    appliedAt: item.appliedAt,
    reviewedAt: item.reviewedAt,
    reviewNote: item.reviewNote,
  };
}

function mapApiAttendanceRow(item: {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number;
  workType: string | null;
  payFactor: number;
  status: string;
}): DistributorWorkAttendanceRow {
  return {
    id: item.id,
    date: item.date,
    clockIn: item.clockIn,
    clockOut: item.clockOut,
    hours: item.hours,
    workType: (item.workType as DistributorWorkAttendanceRow["workType"]) ?? null,
    payFactor: item.payFactor,
    status: item.status as DistributorWorkAttendanceRow["status"],
  };
}

export async function fetchDistributorWorkConfig(): Promise<DistributorWorkAttendanceConfig> {
  const response = await apiRequest<ApiWorkConfigResponse>("/distributor/work/config");
  return {
    workModes: response.workModes,
    timeSlots: response.timeSlots,
    workSites: response.workSites,
  };
}

export async function fetchActiveDistributorWorkSession(): Promise<ApiWorkSession | null> {
  const response = await apiRequest<{ session: ApiWorkSession | null }>(
    "/distributor/work/sessions/active",
  );
  return response.session;
}

export async function signInDistributorWorkSession(payload: {
  workSiteId: "office" | "client-site";
  workModeId: string;
  timeSlotId: string;
  remarks: string | null;
  geolocation: DistributorWorkGeolocation;
}): Promise<ApiWorkSession> {
  return apiRequest<ApiWorkSession>("/distributor/work/sessions/sign-in", {
    method: "POST",
    body: JSON.stringify({
      workSiteId: payload.workSiteId,
      workModeId: payload.workModeId,
      timeSlotId: payload.timeSlotId,
      remarks: payload.remarks,
      geolocation: payload.geolocation,
    }),
  });
}

export async function signOutDistributorWorkSession(): Promise<ApiWorkSession> {
  return apiRequest<ApiWorkSession>("/distributor/work/sessions/sign-out", {
    method: "POST",
  });
}

export async function fetchDistributorWorkAttendance(month?: string): Promise<DistributorWorkAttendanceRow[]> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  const response = await apiRequest<{ items: Array<Parameters<typeof mapApiAttendanceRow>[0]> }>(
    `/distributor/work/attendance${query}`,
  );
  return response.items.map(mapApiAttendanceRow);
}

export async function fetchDistributorPayrollDashboard(periodId?: string): Promise<ApiPayrollDashboard> {
  const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
  const response = await apiRequest<{
    id: string;
    periodLabel: string;
    compensation: DistributorJobCompensation;
    performance: DistributorJobPerformanceCalc;
    promotion: DistributorPayrollPromotion | null;
  }>(`/distributor/work/payroll/dashboard${query}`);
  return response;
}

export async function fetchDistributorLeaveRequests(): Promise<DistributorLeaveRequest[]> {
  const response = await apiRequest<{ items: Array<Parameters<typeof mapApiLeaveRequest>[0]> }>(
    "/distributor/work/leave/requests?scope=self",
  );
  return response.items.map(mapApiLeaveRequest);
}

export async function applyDistributorLeaveRequest(payload: {
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
}): Promise<DistributorLeaveRequest> {
  const response = await apiRequest<{ item: Parameters<typeof mapApiLeaveRequest>[0] }>(
    "/distributor/work/leave/requests",
    {
      method: "POST",
      body: JSON.stringify({
        leaveType: payload.leaveType,
        fromDate: payload.fromDate,
        toDate: payload.toDate,
        reason: payload.reason,
      }),
    },
  );
  return mapApiLeaveRequest(response.item);
}
