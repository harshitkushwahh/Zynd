from __future__ import annotations

from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import DocumentType

_PUBLIC_DOC_TYPES: frozenset[DocumentType] = frozenset(
    {DocumentType.profile_image, DocumentType.family_group_avatar}
)


def is_pii_doc_type(doc_type: DocumentType) -> bool:
    return doc_type not in _PUBLIC_DOC_TYPES


def bucket_for_doc_type(doc_type: DocumentType, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    if doc_type in _PUBLIC_DOC_TYPES:
        return settings.public_assets_bucket
    return settings.pii_documents_bucket


def is_pii_bucket(bucket: str, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return bucket == settings.pii_documents_bucket


def kms_key_for_bucket(bucket: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    if is_pii_bucket(bucket, settings):
        return settings.kms_key_id_pii.strip()
    return settings.kms_key_id_public.strip()
