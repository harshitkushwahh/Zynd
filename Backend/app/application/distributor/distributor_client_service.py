from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.user_admin_service import (
    _kyc_compliant_user_ids,
    get_user_by_reference,
    get_user_summary,
    list_users,
)
from app.application.admin.user_profile_admin_service import get_user_profile_detail
from app.application.auth.oauth_service import list_oauth_connections
from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.application.family_groups.admin_service import (
    get_admin_family_group_detail,
    list_admin_user_family_groups,
)
from app.application.family_groups.errors import FamilyGroupError
from app.application.goals.goal_service import list_personal_goals
from app.application.referral.referral_attribution_service import (
    count_first_investment_for_referrer,
    count_kyc_verified_for_referrer,
    count_qualified_for_referrer,
    count_signups_for_referrer,
    mask_referee_email,
)
from app.application.risk_profile.errors import RiskProfileError
from app.application.risk_profile.report_service import get_or_create_report_pdf
from app.application.risk_profile.scoring_service import (
    get_assessment_admin_detail,
    get_user_risk_profile,
    list_user_assessments,
)
from app.infrastructure.persistence.models import User, UserRole


def _mask_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(char for char in value if char.isdigit())
    if len(digits) < 4:
        return "***"
    return f"••••••{digits[-4:]}"


def _mask_pan_display(pan_last4: str | None) -> str:
    if not pan_last4:
        return "**** **** ****"
    return f"**** **** {pan_last4}"


def _mask_address_block(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    return {
        "city": payload.get("city"),
        "state": payload.get("state"),
        "pincode": payload.get("pincode"),
        "country": payload.get("country"),
    }


def _mask_kyc_for_distributor(kyc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not kyc:
        return None

    address = kyc.get("address")
    masked_address: dict[str, Any] | None = None
    if isinstance(address, dict):
        masked_address = {
            "permanent": _mask_address_block(address.get("permanent")),
            "correspondence": _mask_address_block(address.get("correspondence")),
            "same_as_permanent": bool(address.get("same_as_permanent")),
        }

    investor_addresses: list[dict[str, Any]] = []
    for row in kyc.get("investor_addresses") or []:
        if not isinstance(row, dict):
            continue
        investor_addresses.append(
            {
                "id": row.get("id"),
                "is_primary": row.get("is_primary"),
                "nature": row.get("nature"),
                "city": row.get("city"),
                "state": row.get("state"),
                "postal_code": row.get("postal_code"),
                "country": row.get("country"),
                "sync_status": row.get("sync_status"),
            }
        )

    documents: list[dict[str, Any]] = []
    for document in kyc.get("documents") or []:
        if not isinstance(document, dict):
            continue
        documents.append(
            {
                "id": document.get("id"),
                "doc_type": document.get("doc_type"),
                "status": document.get("status"),
                "created_at": document.get("created_at"),
            }
        )

    signature = kyc.get("signature")
    masked_signature = None
    if isinstance(signature, dict):
        masked_signature = {
            "mode": signature.get("mode"),
            "has_upload": signature.get("has_upload"),
        }

    return {
        "overall_status": kyc.get("overall_status"),
        "last_completed_step": kyc.get("last_completed_step"),
        "active_step_index": kyc.get("active_step_index"),
        "step_statuses": kyc.get("step_statuses"),
        "incomplete_steps": kyc.get("incomplete_steps"),
        "pan": kyc.get("pan"),
        "address": masked_address,
        "investor_addresses": investor_addresses,
        "personal": kyc.get("personal"),
        "bank_draft": kyc.get("bank_draft"),
        "bank_accounts": kyc.get("bank_accounts"),
        "nominees": kyc.get("nominees"),
        "signature": masked_signature,
        "pan_verification_status": kyc.get("pan_verification_status"),
        "bank_verification_status": kyc.get("bank_verification_status"),
        "external_kyc_status": kyc.get("external_kyc_status"),
        "kyc_form_status": kyc.get("kyc_form_status"),
        "investor_profile_status": kyc.get("investor_profile_status"),
        "documents": documents,
    }


def _serialize_list_item(row: dict[str, Any], *, pan_last4: str | None) -> dict[str, Any]:
    kyc_compliant = bool(row.get("kyc_compliant"))
    has_invested = bool(row.get("has_invested"))
    return {
        "user_id": row["user_id"],
        "client_id": row.get("client_id"),
        "display_name": row.get("display_name"),
        "email_masked": mask_referee_email(str(row.get("email") or "")),
        "phone_masked": _mask_phone(row.get("phone")),
        "pan_masked": _mask_pan_display(pan_last4),
        "status": row.get("status"),
        "kyc_compliant": kyc_compliant,
        "has_invested": has_invested,
        "onboarding_status": "Onboarded" if kyc_compliant else "Pending",
        "compliance_status": "Compliant" if kyc_compliant else "Non Compliant",
        "investment_status": "Invested" if has_invested else "Non Invested",
        "investor_type": "Resident Individual",
        "aum": None,
        "created_at": row.get("created_at"),
    }


async def list_distributor_clients(
    db: AsyncSession,
    *,
    email: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    rows = await list_users(
        db,
        email=email,
        role=UserRole.user,
        limit=limit,
        offset=offset,
    )
    items: list[dict[str, Any]] = []
    for row in rows:
        user = await db.get(User, row["user_id"])
        phone = user.phone if user else None
        payload = _serialize_list_item({**row, "phone": phone}, pan_last4=None)
        items.append(payload)
    return items


async def _build_referrals(db: AsyncSession, *, user_id: UUID) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if not user:
        return {
            "total_referrals": 0,
            "kyc_verified": 0,
            "first_investment": 0,
            "qualified": 0,
            "referral_code": "",
        }
    referral_code = await get_or_create_referral_code(db, user=user)
    return {
        "total_referrals": await count_signups_for_referrer(db, referrer_user_id=user_id),
        "kyc_verified": await count_kyc_verified_for_referrer(db, referrer_user_id=user_id),
        "first_investment": await count_first_investment_for_referrer(db, referrer_user_id=user_id),
        "qualified": await count_qualified_for_referrer(db, referrer_user_id=user_id),
        "referral_code": referral_code.code,
    }


async def _serialize_distributor_family_group(
    db: AsyncSession,
    *,
    group_id: UUID,
    client_role: str,
) -> dict[str, Any] | None:
    try:
        detail = await get_admin_family_group_detail(db, group_id=group_id)
    except FamilyGroupError:
        return None

    user_ids = [row["user_id"] for row in detail.get("members") or []]
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=user_ids)
    members: list[dict[str, Any]] = []
    for row in detail.get("members") or []:
        uid = row["user_id"]
        members.append(
            {
                "user_id": uid,
                "display_name": row.get("display_name"),
                "email_masked": row.get("email_masked"),
                "role": row.get("role"),
                "badge_label": row.get("badge_label"),
                "profile_image_url": profile_images.get(uid),
            }
        )

    return {
        "group_id": detail.get("id"),
        "name": detail.get("title"),
        "tag": detail.get("tag"),
        "description": detail.get("description"),
        "avatar_url": detail.get("avatar_url"),
        "head_user_id": detail.get("head_user_id"),
        "head_display_name": detail.get("head_display_name"),
        "member_count": detail.get("member_count") or len(members),
        "status": detail.get("status"),
        "client_role": client_role,
        "members": members,
    }


async def _build_family_groups(db: AsyncSession, *, user_id: UUID) -> list[dict[str, Any]]:
    payload = await list_admin_user_family_groups(db, user_id=user_id)
    groups: list[dict[str, Any]] = []
    for membership in payload.get("memberships") or []:
        role_value = str(membership.get("role") or "member")
        client_role = "owner" if role_value in {"head", "owner"} else "member"
        group_id = membership.get("group_id")
        if not group_id:
            continue
        serialized = await _serialize_distributor_family_group(
            db,
            group_id=group_id,
            client_role=client_role,
        )
        if serialized:
            groups.append(serialized)
    return groups


async def get_distributor_client_family_group(
    db: AsyncSession,
    *,
    client_reference: str,
    group_id: UUID,
) -> dict[str, Any] | None:
    user = await get_user_by_reference(db, client_reference)
    if not user or user.role != UserRole.user:
        return None

    payload = await list_admin_user_family_groups(db, user_id=user.id)
    client_role: str | None = None
    for membership in payload.get("memberships") or []:
        if membership.get("group_id") == group_id:
            role_value = str(membership.get("role") or "member")
            client_role = "owner" if role_value in {"head", "owner"} else "member"
            break
    if client_role is None:
        for created in payload.get("created_groups") or []:
            if created.get("id") == group_id:
                client_role = "owner"
                break
    if client_role is None:
        return None

    serialized = await _serialize_distributor_family_group(
        db,
        group_id=group_id,
        client_role=client_role,
    )
    if not serialized:
        return None
    return {
        **serialized,
        "client_user_id": user.id,
        "client_display_name": _display_name_from_user(user),
    }


def _display_name_from_user(user: User) -> str:
    parts = [user.first_name, user.last_name]
    name = " ".join(part.strip() for part in parts if part and part.strip())
    if name:
        return name
    return mask_referee_email(user.email)


def _serialize_sessions(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for row in rows:
        os_label = row.get("os") or "Unknown OS"
        browser = row.get("browser") or "Browser"
        items.append(
            {
                "id": str(row.get("id")),
                "device_label": f"{browser} on {os_label}",
                "os": os_label,
                "browser": browser,
                "last_active_at": row.get("last_used_at"),
                "is_current": bool(row.get("is_current")),
            }
        )
    return items


def _mask_oauth_connections(raw: dict[str, Any]) -> dict[str, Any]:
    masked: dict[str, Any] = {}
    for provider in ("google", "apple"):
        entry = raw.get(provider)
        if not isinstance(entry, dict):
            masked[provider] = {"connected": False, "email": None}
            continue
        email = entry.get("email")
        masked[provider] = {
            "connected": bool(entry.get("connected")),
            "email": mask_referee_email(email) if isinstance(email, str) and email else None,
        }
    return masked


async def get_distributor_client_detail(
    db: AsyncSession,
    reference: str,
) -> dict[str, Any] | None:
    user = await get_user_by_reference(db, reference)
    if not user or user.role != UserRole.user:
        return None

    summary = await get_user_summary(db, user.id)
    if not summary:
        return None

    profile = await get_user_profile_detail(
        db,
        user.id,
        include_kyc=True,
        include_investments=True,
    )
    kyc = _mask_kyc_for_distributor(profile.get("kyc") if profile else None)
    pan_last4 = None
    if kyc and isinstance(kyc.get("pan"), dict):
        pan_last4 = kyc["pan"].get("pan_last4")

    risk = await get_user_risk_profile(db, user.id)
    risk_label = "Not assessed"
    risk_payload: dict[str, Any] | None = None
    if risk:
        if isinstance(risk.get("tier_config"), dict):
            risk_label = str(risk["tier_config"].get("label") or risk.get("tier") or risk_label)
        elif risk.get("tier"):
            risk_label = str(risk["tier"])
        risk_payload = {
            "label": risk_label,
            "tier": risk.get("tier"),
            "score": risk.get("score"),
            "display_score": risk.get("display_score"),
        }

    goals = await list_personal_goals(db, user_id=user.id)
    family_groups = await _build_family_groups(db, user_id=user.id)
    referrals = await _build_referrals(db, user_id=user.id)
    sessions = _serialize_sessions(await list_user_sessions(db, user_id=user.id))
    connected_accounts = _mask_oauth_connections(await list_oauth_connections(db, user))
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=[user.id])

    kyc_compliant_ids = await _kyc_compliant_user_ids(db, [user.id])
    kyc_compliant = user.id in kyc_compliant_ids
    has_invested = bool(summary.get("has_invested"))

    list_row = _serialize_list_item(
        {
            **summary,
            "email": user.email,
            "phone": user.phone,
            "kyc_compliant": kyc_compliant,
        },
        pan_last4=pan_last4,
    )

    return {
        "summary": list_row,
        "display_name": summary.get("display_name"),
        "email_masked": mask_referee_email(user.email),
        "email_display": mask_referee_email(user.email),
        "phone_masked": _mask_phone(user.phone),
        "pan_masked": _mask_pan_display(pan_last4),
        "risk_profile_label": risk_label,
        "risk_profile": risk_payload,
        "mfa_enabled": user.mfa_enrolled_at is not None,
        "profile_image_url": profile_images.get(user.id),
        "kyc_overall_status": (kyc or {}).get("overall_status") if kyc else "none",
        "kyc": kyc,
        "connected_accounts": connected_accounts,
        "investments": profile.get("investments") if profile else None,
        "goals": goals,
        "family_groups": family_groups,
        "referrals": referrals,
        "sessions": sessions,
        "created_at": user.created_at,
    }


async def _distributor_client_user(db: AsyncSession, reference: str) -> User | None:
    user = await get_user_by_reference(db, reference)
    if not user or user.role != UserRole.user:
        return None
    return user


async def list_distributor_client_risk_assessments(
    db: AsyncSession,
    reference: str,
    *,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any] | None:
    user = await _distributor_client_user(db, reference)
    if not user:
        return None
    return await list_user_assessments(db, user_id=user.id, limit=limit, offset=offset)


async def get_distributor_client_risk_assessment_detail(
    db: AsyncSession,
    reference: str,
    assessment_id: UUID,
) -> dict[str, Any] | None:
    user = await _distributor_client_user(db, reference)
    if not user:
        return None
    try:
        return await get_assessment_admin_detail(
            db,
            user_id=user.id,
            assessment_id=assessment_id,
        )
    except RiskProfileError:
        return None


async def download_distributor_client_risk_report(
    db: AsyncSession,
    reference: str,
    assessment_id: UUID,
) -> tuple[bytes, str] | None:
    user = await _distributor_client_user(db, reference)
    if not user:
        return None
    try:
        pdf_bytes, filename, _from_cache = await get_or_create_report_pdf(
            db,
            user=user,
            assessment_id=assessment_id,
        )
    except RiskProfileError:
        return None
    return pdf_bytes, filename
