from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amc_name_parser import normalize_amc_display_name
from app.application.mf.amfi_nav_parser import slugify
from app.infrastructure.mf.amfi_client import fetch_amfi_member_list
from app.infrastructure.persistence.mf_models import FundAmc

logger = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _normalize_match_key(name: str) -> str:
    text = (normalize_amc_display_name(name) or name).strip().lower()
    return re.sub(r"\s+", " ", text)


def _first_token(name: str) -> str | None:
    for token in _TOKEN_RE.findall(_normalize_match_key(name)):
        if len(token) >= 3:
            return token
    return None


@dataclass
class AmfiMemberLookup:
    by_name: dict[str, str] = field(default_factory=dict)
    by_slug: dict[str, str] = field(default_factory=dict)
    members: list[tuple[str, str]] = field(default_factory=list)


def build_amfi_member_lookup(members: list[dict]) -> AmfiMemberLookup:
    lookup = AmfiMemberLookup()
    for row in members:
        mf_id = str(row.get("mfId") or row.get("mf_id") or "").strip()
        mf_name = str(row.get("mfName") or row.get("mf_name") or "").strip()
        if not mf_id or not mf_name:
            continue
        lookup.members.append((mf_id, mf_name))
        lookup.by_name[_normalize_match_key(mf_name)] = mf_id
        lookup.by_slug[slugify(mf_name)] = mf_id
    return lookup


def resolve_amfi_mf_id(
    *,
    amc_name: str,
    amc_slug: str,
    amfi_amc_names: set[str] | None,
    lookup: AmfiMemberLookup,
) -> str | None:
    candidate_names: list[str] = []
    if amc_name.strip():
        candidate_names.append(amc_name.strip())
    for name in sorted(amfi_amc_names or ()):
        if name and name.strip():
            candidate_names.append(name.strip())

    seen: set[str] = set()
    for raw_name in candidate_names:
        normalized = normalize_amc_display_name(raw_name) or raw_name
        key = _normalize_match_key(normalized)
        if key in seen:
            continue
        seen.add(key)
        if key in lookup.by_name:
            return lookup.by_name[key]
        slug = slugify(normalized)
        if slug in lookup.by_slug:
            return lookup.by_slug[slug]

    if amc_slug.strip() and amc_slug in lookup.by_slug:
        return lookup.by_slug[amc_slug]

    for raw_name in candidate_names:
        token = _first_token(raw_name)
        if not token:
            continue
        matches = [
            mf_id
            for mf_id, mf_name in lookup.members
            if _normalize_match_key(mf_name).startswith(f"{token} ")
            or _normalize_match_key(mf_name) == f"{token} mutual fund"
        ]
        if len(matches) == 1:
            return matches[0]
    return None


async def sync_fund_amc_codes_from_amfi(
    session: AsyncSession,
    *,
    members: list[dict] | None = None,
    amc_names_by_id: dict[int, set[str]] | None = None,
) -> dict[str, int]:
    """Fill fund_amcs.amc_code from AMFI member MF_IDs when still empty."""
    member_rows = members if members is not None else await fetch_amfi_member_list()
    lookup = build_amfi_member_lookup(member_rows)

    amcs = list((await session.scalars(select(FundAmc).order_by(FundAmc.id))).all())
    assigned_codes = {amc.amc_code for amc in amcs if amc.amc_code}

    updated = skipped = unmatched = 0
    for amc in amcs:
        if amc.amc_code:
            skipped += 1
            continue

        mf_id = resolve_amfi_mf_id(
            amc_name=amc.name,
            amc_slug=amc.slug,
            amfi_amc_names=(amc_names_by_id or {}).get(amc.id),
            lookup=lookup,
        )
        if not mf_id:
            unmatched += 1
            continue
        if mf_id in assigned_codes:
            logger.warning(
                "AMFI mfId=%s already assigned; skipping amc_id=%s name=%s",
                mf_id,
                amc.id,
                amc.name,
            )
            unmatched += 1
            continue

        amc.amc_code = mf_id
        assigned_codes.add(mf_id)
        updated += 1

    return {
        "amc_codes_updated": updated,
        "amc_codes_skipped_existing": skipped,
        "amc_codes_unmatched": unmatched,
        "amfi_members_loaded": len(lookup.members),
    }
