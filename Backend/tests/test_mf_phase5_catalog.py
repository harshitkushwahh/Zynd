from __future__ import annotations

from enum import Enum


class ProductLifecycleStatus(str, Enum):
    draft = "DRAFT"
    active = "ACTIVE"
    inactive = "INACTIVE"


def is_catalog_eligible(
    *,
    amc_active: bool,
    fund_active: bool,
    fp_oms_purchase_allowed: bool | None,
    fp_oms_active: bool | None,
) -> bool:
    if not amc_active or not fund_active:
        return False
    if fp_oms_purchase_allowed is not True:
        return False
    if fp_oms_active is False:
        return False
    return True


def resolve_lifecycle_status(current: ProductLifecycleStatus, eligible: bool) -> ProductLifecycleStatus:
    if eligible:
        return ProductLifecycleStatus.active
    if current == ProductLifecycleStatus.active:
        return ProductLifecycleStatus.inactive
    return current


def test_catalog_eligible_requires_empanelled_amc_and_purchase_allowed() -> None:
    assert is_catalog_eligible(
        amc_active=True,
        fund_active=True,
        fp_oms_purchase_allowed=True,
        fp_oms_active=True,
    )
    assert not is_catalog_eligible(
        amc_active=False,
        fund_active=True,
        fp_oms_purchase_allowed=True,
        fp_oms_active=True,
    )
    assert not is_catalog_eligible(
        amc_active=True,
        fund_active=True,
        fp_oms_purchase_allowed=False,
        fp_oms_active=True,
    )


def test_resolve_lifecycle_promotes_draft_to_active() -> None:
    status = resolve_lifecycle_status(ProductLifecycleStatus.draft, True)
    assert status == ProductLifecycleStatus.active


def test_resolve_lifecycle_demotes_active_to_inactive() -> None:
    status = resolve_lifecycle_status(ProductLifecycleStatus.active, False)
    assert status == ProductLifecycleStatus.inactive


def test_public_asset_url_uses_cdn_when_configured() -> None:
    from types import SimpleNamespace

    key = "public/amcs/hdfc.png"
    settings = SimpleNamespace(
        resolved_documents_cdn_base_url="https://cdn.zynd.test/assets",
        resolved_api_public_url="http://localhost:8000/api/v1",
    )
    cdn_base = settings.resolved_documents_cdn_base_url
    url = f"{cdn_base}/{key.lstrip('/')}"
    assert url == "https://cdn.zynd.test/assets/public/amcs/hdfc.png"
