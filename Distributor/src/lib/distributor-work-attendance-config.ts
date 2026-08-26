/** Admin-defined work settings (Phase 1: local defaults until backend config exists). */

export type DistributorWorkModeId = "field" | "office" | "hybrid";

export type DistributorWorkModeOption = {
  id: DistributorWorkModeId;
  label: string;
  description: string;
};

export type DistributorWorkTimeSlotOption = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
};

export type DistributorWorkSiteOption = {
  id: "office" | "client-site";
  label: string;
  payFactorHint: string;
};

export type DistributorWorkAttendanceConfig = {
  workModes: DistributorWorkModeOption[];
  timeSlots: DistributorWorkTimeSlotOption[];
  workSites: DistributorWorkSiteOption[];
};

export const DEFAULT_DISTRIBUTOR_WORK_ATTENDANCE_CONFIG: DistributorWorkAttendanceConfig = {
  workModes: [
    {
      id: "office",
      label: "Office",
      description: "Branch or company office work",
    },
    {
      id: "field",
      label: "Field",
      description: "Client visits and on-site meetings",
    },
    {
      id: "hybrid",
      label: "Hybrid",
      description: "Mix of office and field in the same day",
    },
  ],
  timeSlots: [
    { id: "morning", label: "Morning shift", startTime: "09:00", endTime: "14:00" },
    { id: "afternoon", label: "Afternoon shift", startTime: "14:00", endTime: "19:00" },
    { id: "full-day", label: "Full day", startTime: "09:00", endTime: "18:00" },
  ],
  workSites: [
    { id: "office", label: "Office", payFactorHint: "Standard pay factor" },
    { id: "client-site", label: "Client site", payFactorHint: "1.15× field allowance" },
  ],
};
