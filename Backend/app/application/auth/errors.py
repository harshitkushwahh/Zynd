from __future__ import annotations

from typing import Any


class AuthError(Exception):
    def __init__(
        self,
        message: str,
        code: str = "auth_error",
        status_code: int = 400,
        metadata: dict[str, Any] | None = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.metadata = metadata or {}
        super().__init__(message)
