from app.application.support.help_bot_field_catalog import (
    prefix_match_path,
    all_paths,
)


def test_prefix_match_nested_field() -> None:
    assert prefix_match_path("payments.sip_plans.status") == "payments.sip_plans.status"
    assert prefix_match_path("payments.sip_plans.status.extra") == "payments.sip_plans.status"


def test_catalog_non_empty() -> None:
    assert len(all_paths()) >= 60
