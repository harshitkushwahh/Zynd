from __future__ import annotations

from datetime import datetime
from typing import Protocol


class DocumentStorageBackend(Protocol):
    provider: str

    def write_bytes(
        self,
        *,
        bucket: str,
        storage_key: str,
        content: bytes,
        encrypt_at_rest: bool,
    ) -> None: ...

    def read_bytes(
        self,
        *,
        bucket: str,
        storage_key: str,
        decrypt_at_rest: bool,
    ) -> bytes: ...

    def exists(self, *, bucket: str, storage_key: str) -> bool: ...

    def delete_object(self, *, bucket: str, storage_key: str, force: bool = False) -> None: ...

    def move_object(self, *, bucket: str, storage_key: str, dest_key: str) -> None: ...

    def apply_worm_retention(
        self,
        *,
        bucket: str,
        storage_key: str,
        retain_until: datetime,
    ) -> None: ...
