from __future__ import annotations

from typing import Protocol
from uuid import UUID

from app.infrastructure.persistence.models import User


class UserRepository(Protocol):
    async def get_by_id(self, user_id: UUID) -> User | None:
        ...

    async def get_by_email(self, email: str) -> User | None:
        ...
