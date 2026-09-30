from __future__ import annotations

# PNG, JPEG, WEBP, PDF magic-byte prefixes used during async document scan.
_MIME_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/webp": (b"RIFF",),
    "image/heic": (b"ftyp",),
    "image/heif": (b"ftyp",),
    "application/pdf": (b"%PDF-",),
}


def _matches_heic_container(content: bytes) -> bool:
    if len(content) < 12:
        return False
    if content[4:8] != b"ftyp":
        return False
    brand = content[8:12]
    return brand in {b"heic", b"heif", b"mif1", b"msf1", b"heix", b"hevc"}


def mime_matches_content(mime_type: str, content: bytes) -> bool:
    signatures = _MIME_SIGNATURES.get(mime_type)
    if not signatures:
        return False

    if mime_type == "image/webp":
        return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"

    if mime_type in {"image/heic", "image/heif"}:
        return _matches_heic_container(content)

    return any(content.startswith(signature) for signature in signatures)
