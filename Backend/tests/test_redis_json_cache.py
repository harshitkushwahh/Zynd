from app.application.shared.redis_json_cache import effective_ttl_seconds


def test_effective_ttl_adds_bounded_jitter() -> None:
    base = 300
    jitter = 120
    values = {effective_ttl_seconds(f"auth:user_public:{index}", base, jitter) for index in range(50)}
    assert all(base <= value <= base + jitter for value in values)
    assert len(values) > 1


def test_effective_ttl_without_jitter() -> None:
    assert effective_ttl_seconds("auth:test", 60, 0) == 60
