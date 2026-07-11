from __future__ import annotations

from app.application.documents.document_mime_validation import mime_matches_content


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def test_mime_matches_png_content() -> None:
    assert mime_matches_content("image/png", _png_bytes()) is True


def test_mime_mismatch_rejects_content() -> None:
    assert mime_matches_content("application/pdf", _png_bytes()) is False
