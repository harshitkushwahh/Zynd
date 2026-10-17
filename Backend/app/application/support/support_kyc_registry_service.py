"""FinPrim registry cards for Support console (investor profile, MFIA, nominees)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.user_profile_admin_service import _serialize_investor_nominee
from app.application.investor.investor_bank_account_service import serialize_bank_account
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
    InvestorProfile,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount
from app.infrastructure.persistence.models import KycJourneyState, UserRole


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dt_iso(value: datetime | None) -> str:
    if value is None:
        return _utc_now_iso()
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _field(label: str, value: str | None) -> dict[str, str | None]:
    return {"label": label, "value": value}


def _variant(
    *,
    variant_id: str,
    updated_at: datetime | None,
    summary_fields: list[dict[str, str | None]],
    partner_response: dict[str, Any],
    system_stored: dict[str, Any],
) -> dict[str, Any]:
    iso = _dt_iso(updated_at)
    return {
        "id": variant_id,
        "label": iso,
        "updated_at": iso,
        "summary_fields": summary_fields,
        "partner_response": partner_response,
        "system_stored": system_stored,
    }


def _format_income_slab(value: str | None) -> str | None:
    if not value:
        return None
    return value.replace("_", " ").title()


def _format_pep(value: str | None) -> str | None:
    if not value:
        return None
    mapping = {
        "not_applicable": "No",
        "pep_exposed": "Yes — PEP exposed",
        "pep_related": "Yes — related to a PEP",
    }
    return mapping.get(value, value.replace("_", " ").title())


def _primary_bank_label(banks: list[dict[str, Any]]) -> str | None:
    primary = next((row for row in banks if row.get("is_primary")), banks[0] if banks else None)
    if not primary:
        return "Not linked"
    bank_name = str(primary.get("bank_name") or "Bank")
    last4 = primary.get("account_number_last4")
    if last4:
        return f"{bank_name} •••• {last4}"
    masked = primary.get("account_number_masked")
    return str(masked) if masked else bank_name


def _nominee_partner_payload(
    rows: list[InvestorRelatedParty],
    *,
    mfia_id: str | None,
    updated_at: datetime | None,
) -> dict[str, Any]:
    nominees: list[dict[str, Any]] = []
    for row in rows:
        payload = row.external_payload_json if isinstance(row.external_payload_json, dict) else None
        if payload:
            nominees.append(payload)
            continue
        nominees.append(
            {
                "name": row.name,
                "relationship": row.party_relationship,
                "share_percent": row.share_percent,
                "external_related_party_id": row.external_related_party_id,
            }
        )
    return {
        "object": "nominee_collection",
        "investment_account_id": mfia_id,
        "nominees": nominees,
        "updated_at": _dt_iso(updated_at),
    }


def _nominee_summary(
    serialized_rows: list[dict[str, Any]],
) -> list[dict[str, str | None]]:
    count = len(serialized_rows)
    if count == 0:
        return [
            _field("Nominees on file", "0"),
            _field("Primary nominee", "Not added"),
            _field("Total share", "0%"),
            _field("Sync status", "Not started"),
        ]

    primary = serialized_rows[0]
    rel = primary.get("relationship")
    name = primary.get("name") or "Nominee"
    primary_label = f"{name} ({str(rel).title()})" if rel else name
    total_share = sum(int(row.get("share_percent") or 0) for row in serialized_rows)
    sync_values = {str(row.get("sync_status") or "") for row in serialized_rows if row.get("sync_status")}
    if len(sync_values) == 1:
        sync_label = next(iter(sync_values)).replace("_", " ").title()
    elif not sync_values:
        sync_label = "Unknown"
    else:
        sync_label = "Mixed"

    return [
        _field("Nominees on file", str(count)),
        _field("Primary nominee", primary_label),
        _field("Total share", f"{total_share}%"),
        _field("Sync status", sync_label),
    ]


async def build_support_kyc_registry_snapshot(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    client_code: str,
    display_name: str,
    email_masked: str | None = None,
    phone_masked: str | None = None,
) -> dict[str, Any]:
    profile = await db.get(InvestorProfile, user_id)
    mf_account = await db.scalar(select(MfInvestmentAccount).where(MfInvestmentAccount.user_id == user_id))
    journey = await db.get(KycJourneyState, user_id)

    personal: dict[str, Any] = {}
    if journey and isinstance(journey.personal_draft_json, dict):
        personal = journey.personal_draft_json

    bank_rows = (
        await db.scalars(
            select(InvestorBankAccount)
            .where(InvestorBankAccount.investor_profile_id == user_id)
            .order_by(InvestorBankAccount.is_primary.desc(), InvestorBankAccount.created_at.asc())
        )
    ).all()
    banks = [serialize_bank_account(row) for row in bank_rows]

    address_row = (
        await db.scalar(
            select(InvestorAddress)
            .where(InvestorAddress.investor_profile_id == user_id)
            .order_by(InvestorAddress.is_primary.desc(), InvestorAddress.created_at.asc())
        )
    )

    nominee_rows = (
        await db.scalars(
            select(InvestorRelatedParty)
            .where(InvestorRelatedParty.investor_profile_id == user_id)
            .order_by(InvestorRelatedParty.created_at.asc())
        )
    ).all()
    serialized_nominees = [_serialize_investor_nominee(row) for row in nominee_rows]
    nominee_updated = max((row.updated_at for row in nominee_rows), default=None)

    # --- MF investment account ---
    if mf_account and mf_account.fp_mfia_id:
        mf_status = mf_account.status.value
        mf_summary = [
            _field("Investment account", mf_account.fp_mfia_id),
            _field("Holder", display_name),
            _field("Status", mf_status),
            _field("Primary bank", _primary_bank_label(banks)),
        ]
        mf_metadata = mf_account.metadata_ if isinstance(mf_account.metadata_, dict) else {}
        mf_partner = mf_metadata.get("raw") if isinstance(mf_metadata.get("raw"), dict) else {
            "id": mf_account.fp_mfia_id,
            "object": "mf_investment_account",
            "status": mf_status.lower(),
            "primary_investor_id": profile.external_profile_id if profile else None,
            "updated_at": _dt_iso(mf_account.updated_at),
        }
        mf_system = {
            "table": "mf_investment_accounts",
            "user_id": str(user_id),
            "fp_mfia_id": mf_account.fp_mfia_id,
            "fp_mfia_old_id": mf_account.fp_mfia_old_id,
            "status": mf_status,
            "failure_reason": mf_account.failure_reason,
            "metadata": mf_metadata or None,
            "synced_at": _dt_iso(mf_account.updated_at),
        }
        mf_variant = _variant(
            variant_id="mfia-current",
            updated_at=mf_account.updated_at,
            summary_fields=mf_summary,
            partner_response=mf_partner,
            system_stored=mf_system,
        )
    else:
        mf_summary = [
            _field("Investment account", "Not provisioned"),
            _field("Holder", display_name),
            _field("Status", mf_account.status.value if mf_account else "Not started"),
            _field("Primary bank", _primary_bank_label(banks)),
        ]
        mf_variant = _variant(
            variant_id="mfia-empty",
            updated_at=mf_account.updated_at if mf_account else None,
            summary_fields=mf_summary,
            partner_response={
                "object": "mf_investment_account",
                "status": "not_created",
            },
            system_stored={
                "table": "mf_investment_accounts",
                "user_id": str(user_id),
                "fp_mfia_id": mf_account.fp_mfia_id if mf_account else None,
                "status": mf_account.status.value if mf_account else None,
                "failure_reason": mf_account.failure_reason if mf_account else None,
                "synced_at": None,
            },
        )

    # --- Investor profile (incl. preference fields from KYC personal draft) ---
    city = address_row.city if address_row else None
    if profile and profile.external_profile_id:
        inv_status = profile.status.value
        inv_summary = [
            _field("FinPrim investor", profile.external_profile_id),
            _field("Email", email_masked),
            _field("Mobile", phone_masked),
            _field("Address city", city),
            _field("Income slab", _format_income_slab(personal.get("incomeSlab"))),
            _field("PEP declaration", _format_pep(personal.get("pepExposed"))),
        ]
        metadata = profile.metadata_json if isinstance(profile.metadata_json, dict) else {}
        inv_partner = metadata.get("investor_profile") if isinstance(metadata.get("investor_profile"), dict) else {
            "id": profile.external_profile_id,
            "object": "investor_profile",
            "status": inv_status,
            "updated_at": _dt_iso(profile.updated_at),
        }
        inv_system = {
            "table": "investor_profiles",
            "user_id": str(user_id),
            "fp_investor_id": profile.external_profile_id,
            "fp_investor_old_id": profile.external_old_id,
            "status": inv_status,
            "provider": profile.provider,
            "provision_trigger": profile.provision_trigger.value if profile.provision_trigger else None,
            "failure_code": profile.failure_code,
            "failure_reason": profile.failure_reason,
            "provisioned_at": profile.provisioned_at.isoformat() if profile.provisioned_at else None,
            "income_slab": personal.get("incomeSlab"),
            "pep_exposed": personal.get("pepExposed"),
            "marital_status": personal.get("maritalStatus"),
            "synced_at": _dt_iso(profile.updated_at),
        }
        inv_variant = _variant(
            variant_id="investor-profile-current",
            updated_at=profile.updated_at,
            summary_fields=inv_summary,
            partner_response=inv_partner,
            system_stored=inv_system,
        )
    else:
        inv_summary = [
            _field("FinPrim investor", "Not provisioned"),
            _field("Email", email_masked),
            _field("Mobile", phone_masked),
            _field("Address city", city),
            _field("Income slab", _format_income_slab(personal.get("incomeSlab"))),
            _field("PEP declaration", _format_pep(personal.get("pepExposed"))),
        ]
        inv_variant = _variant(
            variant_id="investor-profile-empty",
            updated_at=profile.updated_at if profile else None,
            summary_fields=inv_summary,
            partner_response={"object": "investor_profile", "status": "not_created"},
            system_stored={
                "table": "investor_profiles",
                "user_id": str(user_id),
                "fp_investor_id": profile.external_profile_id if profile else None,
                "status": profile.status.value if profile else None,
                "income_slab": personal.get("incomeSlab"),
                "pep_exposed": personal.get("pepExposed"),
                "synced_at": _dt_iso(profile.updated_at) if profile else None,
            },
        )

    # --- Nominees ---
    nom_summary = _nominee_summary(serialized_nominees)
    nom_partner = _nominee_partner_payload(
        nominee_rows,
        mfia_id=mf_account.fp_mfia_id if mf_account else None,
        updated_at=nominee_updated,
    )
    nom_system = {
        "table": "investor_related_parties",
        "investment_account_id": mf_account.fp_mfia_id if mf_account else None,
        "rows": serialized_nominees,
        "synced_at": _dt_iso(nominee_updated) if nominee_updated else None,
    }
    nom_variant = _variant(
        variant_id="nominee-current",
        updated_at=nominee_updated,
        summary_fields=nom_summary,
        partner_response=nom_partner,
        system_stored=nom_system,
    )

    return {
        "records": [
            {
                "id": "mf_investment_account",
                "title": "MF investment account",
                "variants": [mf_variant],
            },
            {
                "id": "nominee",
                "title": "Nominee",
                "variants": [nom_variant],
            },
            {
                "id": "investor_profile",
                "title": "Investor profile",
                "variants": [inv_variant],
            },
        ],
    }


async def get_support_kyc_registry_for_reference(
    db: AsyncSession,
    reference: str,
) -> dict[str, Any] | None:
    from app.application.admin.user_admin_service import get_user_by_reference, get_user_summary
    from app.application.distributor.distributor_client_service import (
        _distributor_contact_email,
        _distributor_contact_phone,
    )

    user = await get_user_by_reference(db, reference)
    if not user or user.role != UserRole.user:
        return None

    summary = await get_user_summary(db, user.id)
    if not summary:
        return None

    return await build_support_kyc_registry_snapshot(
        db,
        user.id,
        client_code=str(summary.get("client_id") or user.client_id or reference),
        display_name=str(summary.get("display_name") or "Investor"),
        email_masked=_distributor_contact_email(user.email),
        phone_masked=_distributor_contact_phone(user.phone),
    )
