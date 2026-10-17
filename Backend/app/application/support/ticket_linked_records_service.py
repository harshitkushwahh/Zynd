"""Linked investor / KYC / MFIA cards for support ticket detail."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.journey_gate_service import resolve_kyc_form_type
from app.application.support.ticket_service import _kyc_label
from app.infrastructure.persistence.investor_models import InvestorProfile, InvestorProfileStatus
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount, MfInvestmentAccountStatus
from app.infrastructure.persistence.models import KycJourneyState, User, UserKycStatus
from app.infrastructure.persistence.support_models import SupportTicket


def _investor_profile_status(profile: InvestorProfile | None) -> str:
    if not profile or not profile.external_profile_id:
        return "Not provisioned"
    if profile.status == InvestorProfileStatus.active:
        return "Active"
    return profile.status.value.replace("_", " ").title()


def _mfia_status(account: MfInvestmentAccount | None) -> str:
    if not account or not account.fp_mfia_id:
        return "Not provisioned"
    if account.status == MfInvestmentAccountStatus.active:
        return "Active"
    return account.status.value.title()


def _kyc_form_label(journey: KycJourneyState | None) -> str:
    form_type = resolve_kyc_form_type(journey)
    if form_type == "modify":
        return "KYC update (modify)"
    return "Fresh KYC"


async def build_ticket_linked_records(
    db: AsyncSession,
    *,
    user: User,
    ticket: SupportTicket,
) -> list[dict[str, Any]]:
    client_code = user.client_id or str(user.id)
    user_href = f"/dashboard/users/{client_code}"

    profile = await db.get(InvestorProfile, user.id)
    mf_account = await db.scalar(select(MfInvestmentAccount).where(MfInvestmentAccount.user_id == user.id))
    journey = await db.get(KycJourneyState, user.id)
    kyc_status = await db.get(UserKycStatus, user.id)
    overall = kyc_status.overall_status.value if kyc_status else "none"
    kyc_label, _kyc_compliant = _kyc_label(overall)

    investor_fp_id = profile.external_profile_id if profile else None
    mfia_id = mf_account.fp_mfia_id if mf_account else None
    kyc_form_id = journey.external_kyc_form_id if journey else None
    kyc_form_type = _kyc_form_label(journey) if journey else "Fresh KYC"

    kyc_record_id = kyc_form_id or "Not created"
    kyc_description = kyc_form_type
    if kyc_form_id:
        kyc_description = f"{kyc_form_type} · Cybrilla kyc_form"

    return [
        {
            "key": "user",
            "title": "Investor profile",
            "record_id": investor_fp_id or client_code,
            "href": user_href,
            "status_label": kyc_label,
            "description": user.client_id or "Zynd client record",
            "api_route": "GET /api/v1/support/console/users/{client_reference}",
            "data_points": ["fp_investor_id", "client_id", "display_name", "kyc_status"],
        },
        {
            "key": "investment",
            "title": "MF investment account",
            "record_id": mfia_id or "Not provisioned",
            "href": f"{user_href}?tab=portfolio",
            "status_label": _mfia_status(mf_account),
            "description": "Cybrilla mf_investment_account for this investor.",
            "api_route": "GET /api/v1/support/console/users/{client_reference}/kyc-registry",
            "data_points": ["fp_mfia_id", "status", "primary_bank"],
        },
        {
            "key": "kyc",
            "title": "KYC application",
            "record_id": kyc_record_id,
            "href": f"{user_href}?tab=kyc",
            "status_label": kyc_label,
            "description": kyc_description,
            "api_route": "GET /api/v1/support/console/users/{client_reference}",
            "data_points": ["kyc_form_id", "kyc_form_type", "overall_status", "step_statuses"],
        },
        {
            "key": "ticket",
            "title": "This ticket",
            "record_id": ticket.public_id,
            "status_label": ticket.status,
            "description": ticket.subject,
            "api_route": "GET /api/v1/support/console/tickets/{ticket_id}",
            "data_points": ["ticket_id", "priority", "assignee_id", "sla"],
        },
    ]
