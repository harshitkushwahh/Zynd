from __future__ import annotations

from app.core.config import Settings, get_settings
from app.infrastructure.storage.documents.local_backend import LocalDocumentStorageBackend
from app.infrastructure.storage.documents.protocol import DocumentStorageBackend
from app.infrastructure.storage.documents.s3_backend import S3DocumentStorageBackend


def get_document_storage(settings: Settings | None = None) -> DocumentStorageBackend:
    settings = settings or get_settings()
    if settings.document_storage_provider == "s3":
        return S3DocumentStorageBackend(settings)
    return LocalDocumentStorageBackend(settings)
