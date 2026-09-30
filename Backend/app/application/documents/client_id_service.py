from __future__ import annotations

import re
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import User

_CLIENT_ID_SUFFIX = "@zynd"
_MAX_PREFIX_LEN = 48

ZYND_PERSONA_MITRA = "M"
ZYND_PERSONA_MANAGER = "MG"
ZYND_PERSONA_HEAD = "D"

_ZYND_PERSONA_ID_PATTERN = re.compile(r"^ZYND-(M|MG|D)-([A-Z]{2})(\d{3})$")


def zynd_persona_role_code_for_admin_role(role_key: str) -> str | None:
    """Map RBAC role key to Zynd persona prefix for client_id assignment."""
    normalized = role_key.strip().lower()
    if normalized == "mitra":
        return ZYND_PERSONA_MITRA
    if normalized == "mitra_manager":
        return ZYND_PERSONA_MANAGER
    if normalized in {"mitra_state_head", "mitra_super_head"}:
        return ZYND_PERSONA_HEAD
    return None


def _sanitize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def build_client_id_candidate(email: str, phone: str | None) -> str:
    local_part = email.split("@", 1)[0]
    tokens = [token for token in re.split(r"[._+\-]+", local_part) if token]
    first = _sanitize_token(tokens[0]) if tokens else "user"
    second = _sanitize_token(tokens[1]) if len(tokens) > 1 else ""
    prefix = (first + second)[:_MAX_PREFIX_LEN] or "user"
    phone_digits = "".join(character for character in (phone or "") if character.isdigit())
    if not phone_digits:
        phone_digits = secrets.token_hex(4)
    return f"{prefix}{phone_digits}{_CLIENT_ID_SUFFIX}"


def with_collision_suffix(client_id: str, attempt: int) -> str:
    if attempt <= 1:
        return client_id
    if client_id.endswith(_CLIENT_ID_SUFFIX):
        stem = client_id[: -len(_CLIENT_ID_SUFFIX)]
        return f"{stem}-{attempt}{_CLIENT_ID_SUFFIX}"
    return f"{client_id}-{attempt}"


def build_zynd_persona_initials(
    first_name: str | None,
    last_name: str | None,
) -> str:
    first = (first_name or "").strip()
    last = (last_name or "").strip()
    if first and last:
        return f"{first[0]}{last[0]}".upper()
    if len(first) >= 2:
        return first[:2].upper()
    if first:
        return f"{first[0]}X".upper()
    return "XX"


def build_zynd_persona_client_id(
    *,
    first_name: str | None,
    last_name: str | None,
    role_code: str,
    series: int,
) -> str:
    initials = build_zynd_persona_initials(first_name, last_name)
    return f"ZYND-{role_code}-{initials}{series:03d}"


def is_zynd_persona_client_id(client_id: str | None, role_code: str) -> bool:
    if not client_id:
        return False
    match = _ZYND_PERSONA_ID_PATTERN.match(client_id)
    if match is None:
        return False
    return match.group(1) == role_code


async def resolve_unique_client_id(
    db: AsyncSession,
    *,
    email: str,
    phone: str | None,
) -> str:
    candidate = build_client_id_candidate(email, phone)
    attempt = 1
    while True:
        current = with_collision_suffix(candidate, attempt)
        result = await db.execute(select(User.id).where(User.client_id == current).limit(1))
        if result.scalar_one_or_none() is None:
            return current
        attempt += 1


async def resolve_unique_zynd_persona_client_id(
    db: AsyncSession,
    *,
    first_name: str | None,
    last_name: str | None,
    role_code: str,
) -> str:
    initials = build_zynd_persona_initials(first_name, last_name)
    prefix = f"ZYND-{role_code}-{initials}"
    pattern = re.compile(rf"^{re.escape(prefix)}(\d{{3}})$")

    result = await db.execute(select(User.client_id).where(User.client_id.like(f"{prefix}%")))
    max_series = 0
    for (client_id,) in result.all():
        match = pattern.match(client_id)
        if match:
            max_series = max(max_series, int(match.group(1)))

    return build_zynd_persona_client_id(
        first_name=first_name,
        last_name=last_name,
        role_code=role_code,
        series=max_series + 1,
    )


def is_placeholder_client_id(client_id: str | None) -> bool:
    """Detect SQLAlchemy default test IDs assigned before real client_id resolution."""
    return bool(client_id and client_id.startswith("test-") and client_id.endswith("@zynd"))


async def assign_client_id(db: AsyncSession, user: User) -> str:
    if user.client_id and not is_placeholder_client_id(user.client_id):
        return user.client_id
    user.client_id = await resolve_unique_client_id(db, email=user.email, phone=user.phone)
    return user.client_id


async def assign_zynd_persona_client_id(
    db: AsyncSession,
    user: User,
    *,
    role_code: str,
    first_name: str | None = None,
    last_name: str | None = None,
    force: bool = False,
) -> str:
    if user.client_id and not force and is_zynd_persona_client_id(user.client_id, role_code):
        return user.client_id

    user.client_id = await resolve_unique_zynd_persona_client_id(
        db,
        first_name=first_name or user.first_name,
        last_name=last_name or user.last_name,
        role_code=role_code,
    )
    return user.client_id
