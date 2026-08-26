from __future__ import annotations

from app.application.mf.amc_amfi_code_service import (
    build_amfi_member_lookup,
    resolve_amfi_mf_id,
)


SAMPLE_MEMBERS = [
    {"mfId": "85", "mfName": "Abakkus Mutual Fund"},
    {"mfId": "3", "mfName": "Aditya Birla Sun Life Mutual Fund"},
    {"mfId": "53", "mfName": "Axis Mutual Fund"},
    {"mfId": "6", "mfName": "DSP Mutual Fund"},
    {"mfId": "9", "mfName": "HDFC Mutual Fund"},
    {"mfId": "20", "mfName": "ICICI Prudential Mutual Fund"},
]


def test_resolve_amfi_mf_id_exact_name_match() -> None:
    lookup = build_amfi_member_lookup(SAMPLE_MEMBERS)
    assert (
        resolve_amfi_mf_id(
            amc_name="HDFC Mutual Fund",
            amc_slug="hdfc-mutual-fund",
            amfi_amc_names=set(),
            lookup=lookup,
        )
        == "9"
    )


def test_resolve_amfi_mf_id_slug_match() -> None:
    lookup = build_amfi_member_lookup(SAMPLE_MEMBERS)
    assert (
        resolve_amfi_mf_id(
            amc_name="Axis Asset Management",
            amc_slug="axis-mutual-fund",
            amfi_amc_names=set(),
            lookup=lookup,
        )
        == "53"
    )


def test_resolve_amfi_mf_id_uses_master_amc_name_for_short_catalog_name() -> None:
    lookup = build_amfi_member_lookup(SAMPLE_MEMBERS)
    assert (
        resolve_amfi_mf_id(
            amc_name="ICICI Mutual Fund",
            amc_slug="icici-mutual-fund",
            amfi_amc_names={"ICICI Prudential Mutual Fund"},
            lookup=lookup,
        )
        == "20"
    )


def test_resolve_amfi_mf_id_first_token_fallback() -> None:
    lookup = build_amfi_member_lookup(SAMPLE_MEMBERS)
    assert (
        resolve_amfi_mf_id(
            amc_name="ICICI Mutual Fund",
            amc_slug="icici-mutual-fund",
            amfi_amc_names=set(),
            lookup=lookup,
        )
        == "20"
    )


def test_resolve_amfi_mf_id_returns_none_when_unmatched() -> None:
    lookup = build_amfi_member_lookup(SAMPLE_MEMBERS)
    assert (
        resolve_amfi_mf_id(
            amc_name="Totally Unknown AMC",
            amc_slug="totally-unknown-amc",
            amfi_amc_names=set(),
            lookup=lookup,
        )
        is None
    )
