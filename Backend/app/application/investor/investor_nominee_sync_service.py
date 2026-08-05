"""Sync KYC nominee drafts to Finprim related parties during the KYC journey."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_early_provision_service import ensure_investor_profile_after_pan_confirm
from app.application.investor.investor_nominee_mapper import upsert_nominee_drafts_to_local
from app.application.investor.investor_provision_mapper import (
    build_related_party_patch_payload,
    build_related_party_payload,
)
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_investor_client import create_related_party, patch_related_party
from app.infrastructure.persistence.investor_models import (
    InvestorObjectSyncStatus,
    InvestorProfile,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.models import KycJourneyState, User

logger = logging.getLogger(__name__)


def _mark_party_active(row: InvestorRelatedParty, *, external_id: str, raw: dict | None = None) -> None:
    row.external_related_party_id = external_id
    row.sync_status = InvestorObjectSyncStatus.active
    if raw is not None:
        row.external_payload_json = {
            **(row.external_payload_json or {}),
            "finprim": raw,
        }


def _mark_party_failed(row: InvestorRelatedParty) -> None:
    row.sync_status = InvestorObjectSyncStatus.failed


async def _sync_related_party_row(
    *,
    profile_id: str,
    row: InvestorRelatedParty,
    fp_enabled: bool,
) -> None:
    if row.sync_status == InvestorObjectSyncStatus.active and row.external_related_party_id:
        patch_payload = build_related_party_patch_payload(party_row=row)
        if not patch_payload or not fp_enabled:
            return
        try:
            result = await patch_related_party(patch_payload)
            _mark_party_active(row, external_id=row.external_related_party_id, raw=result.get("raw"))
        except FpClientError as exc:
            _mark_party_failed(row)
            logger.warning(
                "Related party patch failed user_party=%s code=%s",
                row.id,
                exc.code,
            )
        return

    if fp_enabled:
        try:
            result = await create_related_party(build_related_party_payload(profile_id=profile_id, party_row=row))
            external_id = result.get("id")
            if not external_id:
                _mark_party_failed(row)
                return
            _mark_party_active(row, external_id=external_id, raw=result.get("raw"))
            patch_payload = build_related_party_patch_payload(party_row=row)
            if patch_payload:
                patch_result = await patch_related_party(patch_payload)
                _mark_party_active(row, external_id=external_id, raw=patch_result.get("raw"))
        except FpClientError as exc:
            _mark_party_failed(row)
            logger.warning("Related party create failed user_party=%s code=%s", row.id, exc.code)
        return

    stub_id = f"relp_stub_{row.local_nominee_id or row.id.hex[:24]}"
    _mark_party_active(row, external_id=stub_id, raw={"stub": True})


async def sync_nominees_from_kyc_draft(
    db: AsyncSession,
    *,
    user: User,
    journey: KycJourneyState,
) -> InvestorProfile:
    profile = await ensure_investor_profile_after_pan_confirm(db, user=user, journey=journey)
    rows = await upsert_nominee_drafts_to_local(db, profile=profile, journey=journey)
    if not rows:
        return profile

    profile_id = profile.external_profile_id
    if not profile_id:
        return profile

    settings = get_settings()
    fp_enabled = settings.resolved_fp_enabled
    for row in rows:
        await _sync_related_party_row(profile_id=profile_id, row=row, fp_enabled=fp_enabled)

    await db.flush()
    return profile


__all__ = ["sync_nominees_from_kyc_draft"]
