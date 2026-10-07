from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.document_cdn_service import build_cdn_asset_url
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import DocumentStatus, DocumentType, UserDocument


def build_profile_image_public_url(
    document: UserDocument,
    settings: Settings | None = None,
) -> str | None:
    settings = settings or get_settings()
    if document.status != DocumentStatus.active:
        return None
    if document.doc_type != DocumentType.profile_image:
        return None

    cdn_url = build_cdn_asset_url(document, settings)
    if cdn_url:
        return cdn_url

    prefix = settings.api_prefix.rstrip("/")
    path = f"{prefix}/documents/public/{document.id}?v={document.version}"
    return _absolute_api_url(path, settings)


def _absolute_api_url(path: str, settings: Settings) -> str:
    """Turn an API path into a URL the browser can load from the web app host."""
    if path.startswith(("http://", "https://")):
        return path
    if not path.startswith("/"):
        path = f"/{path}"

    public = settings.resolved_api_public_url.rstrip("/")
    prefix = settings.api_prefix.rstrip("/")
    origin = public[: -len(prefix)] if prefix and public.endswith(prefix) else public
    return f"{origin.rstrip('/')}{path}"


async def resolve_profile_image_urls_by_user_id(
    db: AsyncSession,
    user_ids: Sequence[UUID],
    *,
    settings: Settings | None = None,
) -> dict[UUID, str | None]:
    """Map each requested user to their latest active profile image URL.

    Users with no active profile image map to ``None``. One query loads every
    candidate document; the newest version per user wins.
    """
    if not user_ids:
        return {}

    settings = settings or get_settings()
    unique_ids = list(dict.fromkeys(user_ids))
    result = await db.execute(
        select(UserDocument)
        .where(
            UserDocument.user_id.in_(unique_ids),
            UserDocument.doc_type == DocumentType.profile_image,
            UserDocument.status == DocumentStatus.active,
        )
        .order_by(
            UserDocument.user_id.asc(),
            UserDocument.version.desc(),
            UserDocument.created_at.desc(),
        )
    )

    urls: dict[UUID, str | None] = {user_id: None for user_id in unique_ids}
    for document in result.scalars():
        if urls.get(document.user_id):
            continue
        public_url = build_profile_image_public_url(document, settings)
        if public_url:
            urls[document.user_id] = public_url
    return urls
