import pytest

from app.core.config import get_settings
from app.infrastructure.security.rate_limit import check_rate_limit


@pytest.mark.asyncio
async def test_dev_skip_rate_limits_bypasses_check(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DEV_SKIP_RATE_LIMITS", "true")
    get_settings.cache_clear()

    allowed = await check_rate_limit("signup:test@example.com", 1, 3600)
    assert allowed is True


@pytest.mark.asyncio
async def test_dev_skip_rate_limits_not_applied_in_production(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DEV_SKIP_RATE_LIMITS", "true")
    get_settings.cache_clear()

    from unittest.mock import AsyncMock, patch

    redis_mock = AsyncMock()
    redis_mock.incr = AsyncMock(return_value=11)
    redis_mock.expire = AsyncMock()

    with patch("app.infrastructure.security.rate_limit.get_redis", return_value=redis_mock):
        allowed = await check_rate_limit("signup:test@example.com", 10, 3600)

    assert allowed is False
    get_settings.cache_clear()
