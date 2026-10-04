from app.application.mf.scheme_staging_promote_service import (
    scheduler_accept_marker,
    scheduler_can_accept,
)


def test_scheduler_accepts_only_with_a_key() -> None:
    assert scheduler_can_accept(triggered_by="SCHEDULER", secret="nightly-key") is True
    assert scheduler_can_accept(triggered_by="SCHEDULER", secret="  ") is False
    assert scheduler_can_accept(triggered_by="ADMIN", secret="nightly-key") is False
    assert scheduler_can_accept(triggered_by="PIPELINE:run-1", secret="nightly-key") is False


def test_accept_marker_hides_the_secret() -> None:
    marker = scheduler_accept_marker("batch-1", "nightly-key")
    assert marker.startswith("scheduler:")
    assert "nightly-key" not in marker
    assert marker == scheduler_accept_marker("batch-1", "nightly-key")
    assert marker != scheduler_accept_marker("batch-2", "nightly-key")
