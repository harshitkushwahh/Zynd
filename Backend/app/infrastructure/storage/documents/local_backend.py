from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import Settings, get_settings
from app.infrastructure.storage.documents.at_rest_encryption import (
    decrypt_document_blob,
    encrypt_document_blob,
)


class LocalDocumentStorageBackend:
    provider = "local"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def _worm_marker_path(self, *, bucket: str, storage_key: str) -> Path:
        path = self._absolute_path(bucket=bucket, storage_key=storage_key)
        return path.with_name(f"{path.name}.worm")

    def _is_worm_locked(self, *, bucket: str, storage_key: str) -> bool:
        marker = self._worm_marker_path(bucket=bucket, storage_key=storage_key)
        if not marker.is_file():
            return False
        try:
            payload = json.loads(marker.read_text(encoding="utf-8"))
            retain_until = datetime.fromisoformat(payload["retain_until"])
            if retain_until.tzinfo is None:
                retain_until = retain_until.replace(tzinfo=timezone.utc)
            return retain_until > datetime.now(timezone.utc)
        except Exception:
            return True

    def _absolute_path(self, *, bucket: str, storage_key: str) -> Path:
        return self._settings.resolved_documents_root / bucket / storage_key

    def write_bytes(
        self,
        *,
        bucket: str,
        storage_key: str,
        content: bytes,
        encrypt_at_rest: bool,
    ) -> None:
        payload = content
        if encrypt_at_rest and self._settings.documents_local_encrypt_pii:
            payload = encrypt_document_blob(content)

        destination = self._absolute_path(bucket=bucket, storage_key=storage_key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)

    def read_bytes(
        self,
        *,
        bucket: str,
        storage_key: str,
        decrypt_at_rest: bool,
    ) -> bytes:
        payload = self._absolute_path(bucket=bucket, storage_key=storage_key).read_bytes()
        if decrypt_at_rest and self._settings.documents_local_encrypt_pii:
            return decrypt_document_blob(payload)
        return payload

    def exists(self, *, bucket: str, storage_key: str) -> bool:
        return self._absolute_path(bucket=bucket, storage_key=storage_key).is_file()

    def absolute_path(self, *, bucket: str, storage_key: str) -> Path:
        return self._absolute_path(bucket=bucket, storage_key=storage_key)

    def delete_object(self, *, bucket: str, storage_key: str, force: bool = False) -> None:
        if not force and self._is_worm_locked(bucket=bucket, storage_key=storage_key):
            raise PermissionError("Document object is WORM-protected.")
        path = self._absolute_path(bucket=bucket, storage_key=storage_key)
        if path.is_file():
            path.unlink()
        marker = self._worm_marker_path(bucket=bucket, storage_key=storage_key)
        if marker.is_file():
            marker.unlink()

    def apply_worm_retention(
        self,
        *,
        bucket: str,
        storage_key: str,
        retain_until: datetime,
    ) -> None:
        marker = self._worm_marker_path(bucket=bucket, storage_key=storage_key)
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text(
            json.dumps({"retain_until": retain_until.isoformat(), "mode": "COMPLIANCE"}),
            encoding="utf-8",
        )

    def move_object(self, *, bucket: str, storage_key: str, dest_key: str) -> None:
        source = self._absolute_path(bucket=bucket, storage_key=storage_key)
        destination = self._absolute_path(bucket=bucket, storage_key=dest_key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.is_file():
            source.replace(destination)
