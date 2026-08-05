from __future__ import annotations

from pathlib import Path

from app.application.referral.referral_qr_service import generate_referral_qr_png


def test_generate_referral_qr_png_uses_branded_logo() -> None:
    png_bytes = generate_referral_qr_png("https://zynd.test/r/ABC123", size=512)
    assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(png_bytes) > 4_000


def test_generate_referral_qr_png_respects_size(tmp_path: Path) -> None:
    logo_path = tmp_path / "logo.png"
    logo_path.write_bytes(
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    png_bytes = generate_referral_qr_png(
        "https://zynd.test/r/TESTCODE",
        size=320,
        logo_path=logo_path,
    )
    assert len(png_bytes) > 1_200
