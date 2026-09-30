from __future__ import annotations

from urllib.parse import urlencode

from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import DocumentStatus, UserDocument
from app.infrastructure.storage.documents.bucket_policy import is_pii_doc_type, is_pii_bucket


def is_cdn_eligible_document(document: UserDocument, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    if is_pii_doc_type(document.doc_type):
        return False
    if is_pii_bucket(document.storage_bucket, settings):
        return False
    if document.status != DocumentStatus.active:
        return False
    return True


def assert_document_may_use_cdn(document: UserDocument, settings: Settings | None = None) -> None:
    if is_pii_doc_type(document.doc_type) or is_pii_bucket(document.storage_bucket, settings):
        raise ValueError("PII documents must not be served via CDN.")


def _cdn_object_path(document: UserDocument, settings: Settings) -> str:
    base = settings.resolved_documents_cdn_base_url
    if "/documents/public" in base:
        return str(document.id)
    return document.storage_key.lstrip("/")


def build_cdn_asset_url(document: UserDocument, settings: Settings | None = None) -> str | None:
    settings = settings or get_settings()
    if not is_cdn_eligible_document(document, settings):
        return None
    base = settings.resolved_documents_cdn_base_url
    if not base:
        return None

    object_path = _cdn_object_path(document, settings)
    query = urlencode({"v": document.version})
    return f"{base.rstrip('/')}/{object_path}?{query}"


def cdn_delivery_payload(document: UserDocument, settings: Settings | None = None) -> dict[str, object] | None:
    settings = settings or get_settings()
    download_url = build_cdn_asset_url(document, settings)
    if not download_url:
        return None
    return {
        "download_url": download_url,
        "expires_in": settings.documents_public_cache_max_age_seconds,
        "mime_type": document.mime_type,
        "filename": document.original_filename,
        "delivery": "cdn",
        "cache_max_age": settings.documents_public_cache_max_age_seconds,
    }
