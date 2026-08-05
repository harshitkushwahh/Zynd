"""Map KYC nominee draft JSON to local investor related-party rows."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.investor_models import (
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorProfile,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.models import KycJourneyState


def _str(value: Any) -> str:
    return str(value or "").strip()


def _parse_nominee_dob(value: Any) -> date | None:
    raw = _str(value)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def _parse_share_percent(value: Any) -> int | None:
    raw = _str(value)
    if not raw:
        return None
    try:
        return int(float(raw))
    except ValueError:
        return None


def _relationship_key(value: str) -> str:
    return _str(value).lower().replace(" ", "_")


def _document_pan(identity: dict[str, Any]) -> str | None:
    if _str(identity.get("documentType")).lower() != "pan":
        return None
    pan = _str(identity.get("documentNumber"))
    return pan[:10] if pan else None


def _guardian_pan(guardian: dict[str, Any]) -> str | None:
    if _str(guardian.get("documentType")).lower() != "pan":
        return None
    pan = _str(guardian.get("documentNumber"))
    return pan[:10] if pan else None


def nominee_draft_to_related_party_fields(item: dict[str, Any]) -> dict[str, Any] | None:
    core = item.get("core") if isinstance(item.get("core"), dict) else {}
    identity = item.get("identity") if isinstance(item.get("identity"), dict) else {}
    guardian = item.get("guardian") if isinstance(item.get("guardian"), dict) else {}
    name = _str(core.get("fullName"))
    if not name:
        return None
    relationship = _relationship_key(_str(core.get("relationship")) or "others")
    return {
        "local_nominee_id": _str(item.get("id")) or None,
        "name": name[:120],
        "party_relationship": relationship[:64],
        "date_of_birth": _parse_nominee_dob(core.get("dateOfBirth")),
        "pan": _document_pan(identity),
        "guardian_name": _str(guardian.get("name"))[:120] or None,
        "guardian_pan": _guardian_pan(guardian),
        "share_percent": _parse_share_percent(core.get("sharePercent")),
        "external_payload_json": {"kyc_nominee": item},
    }


async def upsert_nominee_drafts_to_local(
    db: AsyncSession,
    *,
    profile: InvestorProfile,
    journey: KycJourneyState,
) -> list[InvestorRelatedParty]:
    nominees = journey.nominee_draft_json
    if not isinstance(nominees, list):
        return []

    existing_rows = list(
        (
            await db.execute(
                select(InvestorRelatedParty).where(
                    InvestorRelatedParty.investor_profile_id == profile.user_id
                )
            )
        ).scalars()
    )
    by_local_id = {
        row.local_nominee_id: row for row in existing_rows if row.local_nominee_id
    }
    seen_local_ids: set[str] = set()
    synced_rows: list[InvestorRelatedParty] = []

    for item in nominees:
        if not isinstance(item, dict):
            continue
        fields = nominee_draft_to_related_party_fields(item)
        if not fields:
            continue
        local_id = fields["local_nominee_id"]
        if not local_id:
            continue
        seen_local_ids.add(local_id)

        row = by_local_id.get(local_id)
        if row is None:
            row = InvestorRelatedParty(
                investor_profile_id=profile.user_id,
                source=InvestorObjectSource.kyc,
                sync_status=InvestorObjectSyncStatus.draft,
            )
            db.add(row)
            by_local_id[local_id] = row

        row.local_nominee_id = local_id
        row.name = fields["name"]
        row.party_relationship = fields["party_relationship"]
        row.date_of_birth = fields["date_of_birth"]
        row.pan = fields["pan"]
        row.guardian_name = fields["guardian_name"]
        row.guardian_pan = fields["guardian_pan"]
        row.share_percent = fields["share_percent"]
        row.external_payload_json = fields["external_payload_json"]
        synced_rows.append(row)

    for row in existing_rows:
        if row.local_nominee_id and row.local_nominee_id not in seen_local_ids:
            await db.delete(row)

    await db.flush()
    return synced_rows


__all__ = ["nominee_draft_to_related_party_fields", "upsert_nominee_drafts_to_local"]
