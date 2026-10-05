from app.application.kyc.country_master import static_kyc_countries
from app.infrastructure.kyc.fp_clients import list_countries


def test_static_kyc_countries_includes_india_and_broad_coverage() -> None:
    rows = static_kyc_countries()
    names = {row["name"] for row in rows}
    assert "India" in names
    assert "United States" in names
    assert len(rows) >= 200
    assert rows[0]["name"] == "India"


async def test_list_countries_falls_back_to_static_when_providers_not_live(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.application.integrations.integration_runtime.is_kyckart_live",
        lambda: False,
    )
    monkeypatch.setattr(
        "app.application.integrations.integration_runtime.is_finprim_enabled",
        lambda: False,
    )

    rows = await list_countries()
    assert len(rows) >= 200
    assert rows[0]["name"] == "India"
