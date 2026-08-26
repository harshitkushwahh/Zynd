from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class WorkGeolocationPayload(BaseModel):
    latitude: float
    longitude: float
    accuracy: float


class WorkSignInRequest(BaseModel):
    work_site_id: str = Field(alias="workSiteId")
    work_mode_id: str = Field(alias="workModeId")
    time_slot_id: str = Field(alias="timeSlotId")
    remarks: str | None = None
    geolocation: WorkGeolocationPayload

    model_config = {"populate_by_name": True}


class WorkSessionResponse(BaseModel):
    id: str
    signed_in_at: str = Field(alias="signedInAt")
    signed_out_at: str | None = Field(default=None, alias="signedOutAt")
    work_site_id: str = Field(alias="workSiteId")
    work_mode_id: str = Field(alias="workModeId")
    time_slot_id: str = Field(alias="timeSlotId")
    remarks: str | None = None
    geolocation: dict
    status: str
    hours: float

    model_config = {"populate_by_name": True}


class WorkSessionStateResponse(BaseModel):
    session: WorkSessionResponse | None


class WorkAttendanceConfigResponse(BaseModel):
    work_modes: list[dict] = Field(alias="workModes")
    time_slots: list[dict] = Field(alias="timeSlots")
    work_sites: list[dict] = Field(alias="workSites")

    model_config = {"populate_by_name": True}


class WorkAttendanceListResponse(BaseModel):
    items: list[dict]


class LeaveApplyRequest(BaseModel):
    leave_type: str = Field(alias="leaveType")
    from_date: date = Field(alias="fromDate")
    to_date: date = Field(alias="toDate")
    reason: str = Field(min_length=3, max_length=500)

    model_config = {"populate_by_name": True}


class LeaveReviewRequest(BaseModel):
    decision: str
    review_note: str | None = Field(default=None, alias="reviewNote")

    model_config = {"populate_by_name": True}


class LeaveRequestResponse(BaseModel):
    item: dict


class LeaveRequestListResponse(BaseModel):
    items: list[dict]


class PayrollPromotionPayload(BaseModel):
    label: str
    previous_base_salary: float = Field(alias="previousBaseSalary")
    new_base_salary: float = Field(alias="newBaseSalary")
    hike_pct: float = Field(alias="hikePct")
    effective_label: str = Field(alias="effectiveLabel")

    model_config = {"populate_by_name": True}


class PayrollDashboardResponse(BaseModel):
    id: str
    period_label: str = Field(alias="periodLabel")
    compensation: dict
    performance: dict
    promotion: PayrollPromotionPayload | None = None

    model_config = {"populate_by_name": True}


class PayrollPeriodListResponse(BaseModel):
    items: list[dict]


class AdminGrantPromotionRequest(BaseModel):
    label: str = Field(min_length=3, max_length=160)
    previous_base_salary: Decimal = Field(alias="previousBaseSalary", gt=0)
    new_base_salary: Decimal = Field(alias="newBaseSalary", gt=0)
    effective_date: date = Field(alias="effectiveDate")

    model_config = {"populate_by_name": True}


class AdminGrantPromotionResponse(BaseModel):
    promotion: dict
