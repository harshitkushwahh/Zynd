from __future__ import annotations

import os

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.application.messaging.scheduled_events import begin_event_batch, discard_scheduled_events
from app.core.config import get_settings
from app.infrastructure.persistence.models import AuditEventType, Base

# Enum values added after initial schema creation — sync for isolated test DBs.
_AUDIT_EVENT_ENUM_EXTENSIONS = [
    member.value
    for member in AuditEventType
    if member.value
    not in {
        "login_success",
        "login_failure",
        "new_device_login",
        "session_created",
        "session_revoked",
        "logout",
        "password_reset_requested",
        "mfa_enrolled",
        "mfa_challenge_success",
        "mfa_challenge_failure",
        "backup_code_used",
        "oauth_link_requested",
        "oauth_link_confirmed",
        "sessions_revoked_all",
        "email_change_requested",
        "email_changed",
        "password_changed",
        "account_deletion_requested",
        "account_deletion_cancelled",
    }
]

# Never default to the dev database — pytest must use an isolated test DB.
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://zynd:zynd@localhost:5432/zynd_test",
)


async def _database_available() -> bool:
    try:
        engine = create_async_engine(TEST_DATABASE_URL, echo=False)
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        await engine.dispose()
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(autouse=True)
def reset_settings_cache() -> None:
    import os

    os.environ["EVENT_DISPATCH_MODE"] = "sync"
    os.environ["DOCUMENT_SCAN_DISPATCH_MODE"] = "sync"
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
    from app.core import redis as redis_module

    redis_module._redis_clients.clear()


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    store: dict[str, str] = {}
    lists: dict[str, list[str]] = {}

    class FakeRedis:
        async def setex(self, key: str, _ttl: int, value: str) -> None:
            store[key] = value

        async def set(self, key: str, value: str, ex: int | None = None) -> None:
            _ = ex
            store[key] = value

        async def get(self, key: str) -> str | None:
            return store.get(key)

        async def exists(self, key: str) -> int:
            return 1 if key in store else 0

        async def delete(self, key: str) -> None:
            store.pop(key, None)

        async def incr(self, key: str) -> int:
            current = int(store.get(key, "0")) + 1
            store[key] = str(current)
            return current

        async def decr(self, key: str) -> int:
            current = int(store.get(key, "0")) - 1
            store[key] = str(current)
            return current

        async def expire(self, key: str, _ttl: int) -> None:
            _ = key

        async def ttl(self, key: str) -> int:
            return 600 if key in store else -1

        async def lpush(self, key: str, value: str) -> int:
            lists.setdefault(key, []).insert(0, value)
            return len(lists[key])

        async def brpop(self, keys: str | list[str], timeout: int = 0) -> tuple[str, str] | None:
            _ = timeout
            key = keys if isinstance(keys, str) else keys[0]
            if lists.get(key):
                return key, lists[key].pop()
            return None

    async def fake_get_redis(_db: int) -> FakeRedis:
        return FakeRedis()

    monkeypatch.setattr("app.core.redis.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.otp.service.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.persistence.signup_draft_store.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.persistence.password_reset_token_store.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.security.rate_limit.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.security.pending_auth.get_redis", fake_get_redis)
    monkeypatch.setattr("app.application.security.security_config_service.get_redis", fake_get_redis)
    monkeypatch.setattr("app.application.auth.progressive_lockout_service.get_redis", fake_get_redis)
    return store


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    if not await _database_available():
        pytest.skip(
            "PostgreSQL test database unavailable. "
            "Create it with: createdb -U zynd zynd_test"
        )

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for value in _AUDIT_EVENT_ENUM_EXTENSIONS:
            await conn.execute(
                text(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")
            )
        await conn.execute(
            text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_family_id UUID")
        )
        await conn.execute(
            text("UPDATE sessions SET token_family_id = id WHERE token_family_id IS NULL")
        )
        await conn.execute(
            text("ALTER TYPE userstatus ADD VALUE IF NOT EXISTS 'suspended'")
        )
        for status_value in ("pending_scan", "rejected", "quarantined"):
            await conn.execute(
                text(f"ALTER TYPE documentstatus ADD VALUE IF NOT EXISTS '{status_value}'")
            )
        await conn.execute(
            text("ALTER TYPE documenttype ADD VALUE IF NOT EXISTS 'nominee_id'")
        )
        await conn.execute(
            text("ALTER TYPE referralstage ADD VALUE IF NOT EXISTS 'kyc_verified'")
        )
        await conn.execute(
            text("ALTER TYPE referralstage ADD VALUE IF NOT EXISTS 'first_investment'")
        )
        await conn.execute(
            text("ALTER TYPE referralstage ADD VALUE IF NOT EXISTS 'qualified'")
        )
        await conn.execute(
            text("ALTER TYPE referralstage ADD VALUE IF NOT EXISTS 'engaged'")
        )
        await conn.execute(
            text(
                """
                DO $$ BEGIN
                    CREATE TYPE referralengagementmilestone AS ENUM (
                        'second_investment',
                        'additional_product',
                        'aum_milestone'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                END $$;
                """
            )
        )
        await conn.execute(
            text(
                """
                DO $$ BEGIN
                    CREATE TYPE referralinvestmentproduct AS ENUM ('mutual_fund', 'fixed_deposit', 'other');
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                END $$;
                """
            )
        )
        for column_sql in (
            "ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ",
            "ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS first_investment_at TIMESTAMPTZ",
            "ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS first_investment_product referralinvestmentproduct",
            "ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS first_investment_amount_inr INTEGER",
            "ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ",
            "ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS first_investment_reversed_at TIMESTAMPTZ",
            "ALTER TABLE referral_attributions ADD COLUMN IF NOT EXISTS engaged_at TIMESTAMPTZ",
        ):
            await conn.execute(text(column_sql))
        await conn.execute(
            text(
                """
                DO $$ BEGIN
                    CREATE TYPE kycreviewstatus AS ENUM ('pending', 'approved', 'rejected');
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                END $$;
                """
            )
        )
        for column_sql in (
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason_code VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by UUID",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id VARCHAR(128)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ",
        ):
            await conn.execute(text(column_sql))
        await conn.execute(
            text(
                "UPDATE users SET client_id = 'test-' || replace(gen_random_uuid()::text, '-', '') || '@zynd' "
                "WHERE client_id IS NULL"
            )
        )
        for column_sql in (
            "ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(16)",
            "ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(128)",
            "ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS immutable_at TIMESTAMPTZ",
            "ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN DEFAULT FALSE",
            "ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ",
            "ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS kyc_review_status kycreviewstatus",
        ):
            await conn.execute(text(column_sql))
        await conn.execute(
            text(
                "UPDATE user_documents "
                "SET storage_provider = COALESCE(storage_provider, 'local'), "
                "storage_bucket = COALESCE(storage_bucket, "
                "CASE WHEN doc_type = 'profile_image' THEN 'zynd-public-assets' "
                "ELSE 'zynd-pii-documents' END) "
                "WHERE storage_provider IS NULL OR storage_bucket IS NULL"
            )
        )

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    begin_event_batch()
    async with session_factory() as session:
        try:
            yield session
        finally:
            discard_scheduled_events()
            await session.rollback()

    await engine.dispose()
