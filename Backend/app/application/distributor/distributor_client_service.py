from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import (
    assign_client_id,
    is_placeholder_client_id,
)
from app.application.admin.user_admin_service import (
    _kyc_compliant_user_ids,
    _kyc_onboarding_complete_user_ids,
    get_user_by_reference,
    get_user_summary,
    list_users,
)
from app.application.admin.user_profile_admin_service import get_user_profile_detail
from app.application.auth.oauth_service import list_oauth_connections
from app.application.auth.session_service import list_user_sessions
from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.application.family_groups.admin_service import (
    get_admin_family_group_detail,
    list_admin_user_family_groups,
)
from app.application.family_groups.errors import FamilyGroupError
from app.application.goals.errors import GoalError
from app.application.goals.family_goal_service import list_family_goals
from app.application.goals.goal_service import list_personal_goals
from app.application.mf.portfolio_holdings_service import get_user_portfolio_summary
from app.application.distributor.distributor_client_link_service import (
    DistributorClientBookError,
    assert_actor_can_read_client_profile,
    get_client_link_for_user,
    list_book_client_user_ids_for_actor,
    map_client_links_by_user_id,
    serialize_client_link,
)
from app.application.referral.referral_attribution_service import (
    count_first_investment_for_referrer,
    count_kyc_verified_for_referrer,
    count_qualified_for_referrer,
    count_signups_for_referrer,
)
from app.application.referral.referral_code_service import get_or_create_referral_code
from app.application.risk_profile.errors import RiskProfileError
from app.application.risk_profile.report_service import get_or_create_report_pdf
from app.application.risk_profile.scoring_service import (
    get_assessment_admin_detail,
    get_user_risk_profile,
    list_user_assessments,
)
from app.infrastructure.persistence.models import User, UserRole


def _distributor_contact_email(value: str | None) -> str:
    return str(value or "").strip()


def _distributor_contact_phone(value: str | None) -> str | None:
    if not value:
        return None
    normalized = str(value).strip()
    return normalized or None


def _mask_pan_display(pan_last4: str | None) -> str:
    if not pan_last4:
        return "**** **** ****"
    return f"**** **** {pan_last4}"


def _mask_address_block(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    return {
        "line1": payload.get("line1"),
        "line2": payload.get("line2"),
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
                "line1": row.get("line1"),
                "line2": row.get("line2"),
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
                "original_filename": document.get("original_filename"),
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
        "kyc_already_registered": kyc.get("kyc_already_registered"),
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
        "audit_log": kyc.get("audit_log"),
    }


def _parse_audit_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _infer_kyc_audit_source_from_sessions(
    occurred_at: datetime | None,
    sessions: list[dict[str, Any]],
) -> str:
    if not occurred_at or not sessions:
        return "Zynd app"

    best_label = "Zynd app"
    best_delta: float | None = None

    for row in sessions:
        for key in ("last_used_at", "created_at"):
            timestamp = _parse_audit_timestamp(row.get(key))
            if timestamp is None:
                continue
            delta = abs((timestamp - occurred_at).total_seconds())
            if best_delta is not None and delta >= best_delta:
                continue
            best_delta = delta
            os_label = str(row.get("os") or "").lower()
            browser = str(row.get("browser") or "").lower()
            if any(token in os_label for token in ("ios", "android", "ipad")):
                best_label = "Mobile app"
            elif browser and browser not in {"browser", "unknown"}:
                best_label = "Web app"
            else:
                best_label = "Zynd app"

    return best_label


def _normalize_kyc_audit_source(
    source: str | None,
    *,
    actor: str,
    occurred_at: datetime | None,
    sessions: list[dict[str, Any]],
) -> str:
    normalized = (source or "").strip()
    if normalized == "KRA provider":
        return "KRA"
    if normalized == "System" or actor == "system":
        return "System"
    if normalized in {"Mobile app", "Web app", "Zynd app"}:
        return normalized
    if normalized == "App" or actor == "investor":
        return _infer_kyc_audit_source_from_sessions(occurred_at, sessions)
    return normalized or "—"


def _enrich_kyc_audit_log_sources(
    audit_log: list[dict[str, Any]] | None,
    *,
    sessions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not audit_log:
        return []

    enriched: list[dict[str, Any]] = []
    for entry in audit_log:
        if not isinstance(entry, dict):
            continue
        occurred_at = _parse_audit_timestamp(entry.get("occurred_at"))
        actor = str(entry.get("actor") or "system")
        enriched.append(
            {
                **entry,
                "source": _normalize_kyc_audit_source(
                    entry.get("source") if isinstance(entry.get("source"), str) else None,
                    actor=actor,
                    occurred_at=occurred_at,
                    sessions=sessions,
                ),
            }
        )
    return enriched


def _serialize_list_item(
    row: dict[str, Any],
    *,
    pan_last4: str | None,
    kyc_onboarding_complete: bool | None = None,
) -> dict[str, Any]:
    kyc_compliant = bool(row.get("kyc_compliant"))
    onboarding_complete = (
        kyc_onboarding_complete if kyc_onboarding_complete is not None else kyc_compliant
    )
    has_invested = bool(row.get("has_invested"))
    return {
        "user_id": row["user_id"],
        "client_id": row.get("client_id"),
        "display_name": row.get("display_name"),
        "email_masked": _distributor_contact_email(str(row.get("email") or "")),
        "phone_masked": _distributor_contact_phone(row.get("phone")),
        "pan_masked": _mask_pan_display(pan_last4),
        "status": row.get("status"),
        "kyc_compliant": kyc_compliant,
        "has_invested": has_invested,
        "onboarding_status": "Onboarded" if onboarding_complete else "Pending",
        "compliance_status": "Compliant" if kyc_compliant else "Non Compliant",
        "investment_status": "Invested" if has_invested else "Non Invested",
        "investor_type": "Resident Individual",
        "aum": None,
        "created_at": row.get("created_at"),
    }


async def list_distributor_clients(
    db: AsyncSession,
    *,
    actor: User,
    scope: str = "book",
    email: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    book_client_ids = set(await list_book_client_user_ids_for_actor(db, actor=actor))
    normalized_scope = scope.strip().lower()
    platform_scope = normalized_scope in {"platform", "all", "platform-wide"}

    if not platform_scope and not book_client_ids:
        return []

    rows = await list_users(
        db,
        email=email,
        role=UserRole.user,
        limit=limit,
        offset=offset,
        user_ids=None if platform_scope else list(book_client_ids),
    )
    items: list[dict[str, Any]] = []
    prepared_rows: list[dict[str, Any]] = []
    for row in rows:
        user = await db.get(User, row["user_id"])
        if user and is_placeholder_client_id(user.client_id):
            await assign_client_id(db, user)
            await db.flush()
            row = {**row, "client_id": user.client_id}
        phone = user.phone if user else None
        prepared_rows.append({**row, "phone": phone})

    links_by_user_id = await map_client_links_by_user_id(
        db,
        client_user_ids=[row["user_id"] for row in prepared_rows],
    )
    onboarding_complete_ids = await _kyc_onboarding_complete_user_ids(
        db,
        [row["user_id"] for row in prepared_rows],
    )

    for row in prepared_rows:
        payload = _serialize_list_item(
            row,
            pan_last4=None,
            kyc_onboarding_complete=row["user_id"] in onboarding_complete_ids,
        )
        in_book = row["user_id"] in book_client_ids
        link = links_by_user_id.get(row["user_id"])
        payload["mitra_client_id"] = link.mitra_client_id if link else None
        payload["in_distributor_book"] = in_book
        payload["service_model"] = "pm" if link else "diy"
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
    member_emails: dict[UUID, str] = {}
    if user_ids:
        member_rows = await db.execute(select(User.id, User.email).where(User.id.in_(user_ids)))
        member_emails = {row.id: row.email for row in member_rows.all()}
    members: list[dict[str, Any]] = []
    for row in detail.get("members") or []:
        uid = row["user_id"]
        members.append(
            {
                "user_id": uid,
                "display_name": row.get("display_name"),
                "email_masked": _distributor_contact_email(
                    member_emails.get(uid) or row.get("email_masked")
                ),
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


async def _list_distributor_client_goals(db: AsyncSession, *, user_id: UUID) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for goal in await list_personal_goals(db, user_id=user_id):
        items.append({**goal, "scope": "personal"})

    memberships_payload = await list_admin_user_family_groups(db, user_id=user_id)
    group_names: dict[UUID, str] = {}
    for membership in memberships_payload.get("memberships") or []:
        group_id = membership.get("group_id")
        if not group_id:
            continue
        group_names[group_id] = str(membership.get("title") or membership.get("name") or "Family group")
    for created in memberships_payload.get("created_groups") or []:
        group_id = created.get("id")
        if not group_id:
            continue
        group_names.setdefault(
            group_id,
            str(created.get("title") or created.get("name") or "Family group"),
        )

    for group_id, group_name in group_names.items():
        try:
            family_goals = await list_family_goals(db, group_id=group_id, user_id=user_id)
        except GoalError:
            continue
        for goal in family_goals:
            items.append({**goal, "scope": "family", "family_group_name": group_name})

    return items


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
    return user.email


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


def _serialize_oauth_connections(raw: dict[str, Any]) -> dict[str, Any]:
    serialized: dict[str, Any] = {}
    for provider in ("google", "apple"):
        entry = raw.get(provider)
        if not isinstance(entry, dict):
            serialized[provider] = {"connected": False, "email": None}
            continue
        email = entry.get("email")
        serialized[provider] = {
            "connected": bool(entry.get("connected")),
            "email": email.strip() if isinstance(email, str) and email.strip() else None,
        }
    return serialized


async def get_distributor_client_detail(
    db: AsyncSession,
    reference: str,
    *,
    actor: User,
) -> dict[str, Any] | None:
    user = await get_user_by_reference(db, reference)
    if not user or user.role != UserRole.user:
        return None

    try:
        await assert_actor_can_read_client_profile(db, actor=actor, client_user=user)
    except DistributorClientBookError:
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
    raw_sessions = await list_user_sessions(db, user_id=user.id)
    kyc = _mask_kyc_for_distributor(profile.get("kyc") if profile else None)
    if kyc:
        audit_log = kyc.get("audit_log")
        kyc["audit_log"] = _enrich_kyc_audit_log_sources(
            audit_log if isinstance(audit_log, list) else None,
            sessions=raw_sessions,
        )
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

    goals = await _list_distributor_client_goals(db, user_id=user.id)
    family_groups = await _build_family_groups(db, user_id=user.id)
    referrals = await _build_referrals(db, user_id=user.id)
    sessions = _serialize_sessions(raw_sessions)
    connected_accounts = _serialize_oauth_connections(await list_oauth_connections(db, user))
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

    link = await get_client_link_for_user(db, client_user_id=user.id)
    list_row["service_model"] = "pm" if link else "diy"
    list_row["mitra_client_id"] = link.mitra_client_id if link else None

    investments = profile.get("investments") if profile else None
    if isinstance(investments, dict):
        portfolio_summary = await get_user_portfolio_summary(db, user_id=user.id)
        investments = {
            **investments,
            "growth": portfolio_summary.get("growth") or [],
        }

    return {
        "summary": list_row,
        "display_name": summary.get("display_name"),
        "email_masked": _distributor_contact_email(user.email),
        "email_display": _distributor_contact_email(user.email),
        "phone_masked": _distributor_contact_phone(user.phone),
        "pan_masked": _mask_pan_display(pan_last4),
        "risk_profile_label": risk_label,
        "risk_profile": risk_payload,
        "mfa_enabled": user.mfa_enrolled_at is not None,
        "profile_image_url": profile_images.get(user.id),
        "kyc_overall_status": (kyc or {}).get("overall_status") if kyc else "none",
        "kyc": kyc,
        "connected_accounts": connected_accounts,
        "investments": investments,
        "goals": goals,
        "family_groups": family_groups,
        "referrals": referrals,
        "sessions": sessions,
        "created_at": user.created_at,
        "book_link": serialize_client_link(link),
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
