from uuid import uuid4

import pytest

from app.application.auth.auth_cache_invalidation import USER_PUBLIC_PREFIX, invalidate_auth_user_caches
from app.application.shared.redis_json_cache import get_json, set_json


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None):
        self.store[key] = value

    async def delete(self, *keys: str):
        for key in keys:
            self.store.pop(key, None)


@pytest.mark.asyncio
async def test_invalidate_auth_user_caches_clears_public_profile(monkeypatch) -> None:
    fake = FakeRedis()
    user_id = uuid4()
    key = f"{USER_PUBLIC_PREFIX}{user_id}"

    async def _fake_get_redis(_db: int, _settings=None):
        return fake

    monkeypatch.setattr("app.application.shared.redis_json_cache.get_redis", _fake_get_redis)
    monkeypatch.setattr("app.application.auth.auth_cache_invalidation.get_redis", _fake_get_redis)

    await set_json(key, {"email": "a@b.com"}, ttl_seconds=60, jitter_seconds=0)
    assert await get_json(key) is not None

    await invalidate_auth_user_caches(user_id)
    assert await get_json(key) is None
