from __future__ import annotations

from uuid import UUID

from app.infrastructure.persistence.models import DocumentType


_MIME_EXTENSIONS: dict[str, str] = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "application/pdf": ".pdf",
}


def extension_for_mime(mime_type: str) -> str:
    extension = _MIME_EXTENSIONS.get(mime_type)
    if not extension:
        raise ValueError(f"Unsupported mime type: {mime_type}")
    return extension


def build_storage_key(
    *,
    client_id: str,
    user_id: UUID,
    doc_type: DocumentType,
    version: int,
    extension: str,
) -> str:
    if doc_type == DocumentType.profile_image:
        return f"public/avatars/{user_id}/v{version}{extension}"

    doc_name = doc_type.value
    filename = f"{doc_name}_{client_id}_v{version}{extension}"
    return f"{client_id}/{doc_name}/{filename}"
