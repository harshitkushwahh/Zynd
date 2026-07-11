from __future__ import annotations

from app.core.config import Settings


def test_development_defaults_event_dispatch_to_sync(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("EVENT_DISPATCH_MODE", "outbox")
    monkeypatch.delenv("EVENT_USE_WORKER_IN_DEV", raising=False)

    settings = Settings()
    assert settings.event_dispatch_mode == "sync"


def test_development_honors_worker_flag(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("EVENT_DISPATCH_MODE", "outbox")
    monkeypatch.setenv("EVENT_USE_WORKER_IN_DEV", "true")

    settings = Settings()
    assert settings.event_dispatch_mode == "outbox"
