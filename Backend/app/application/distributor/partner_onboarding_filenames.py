from __future__ import annotations

import re
from typing import Any

_MIME_EXTENSIONS: dict[str, str] = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
}


def _draft_name_slug(draft: dict[str, Any]) -> str:
    parts = [
        str(draft.get("first_name") or "").strip(),
        str(draft.get("middle_name") or "").strip(),
        str(draft.get("last_name") or "").strip(),
    ]
    raw = "-".join(part for part in parts if part)
    if not raw:
        email = str(draft.get("email") or "").split("@", 1)[0]
        raw = email or "mitra"
    slug = re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")
    return (slug[:48] or "mitra")


def _mobile_suffix(draft: dict[str, Any]) -> str:
    digits = re.sub(r"\D", "", str(draft.get("mobile") or ""))
    if len(digits) >= 4:
        return digits[-4:]
    return digits or "0000"


def partner_onboarding_file_stem(draft: dict[str, Any]) -> str:
    return f"{_draft_name_slug(draft)}-{_mobile_suffix(draft)}"


def extension_for_mime(mime_type: str, fallback: str = ".bin") -> str:
    return _MIME_EXTENSIONS.get(mime_type.lower().strip(), fallback)


def partner_onboarding_document_filename(
    draft: dict[str, Any],
    *,
    doc_type: str,
    mime_type: str,
) -> str:
    stem = partner_onboarding_file_stem(draft)
    suffix = doc_type.strip().lower()
    ext = extension_for_mime(mime_type, ".pdf")
    return f"{stem}-{suffix}{ext}"


def partner_onboarding_profile_photo_filename(
    draft: dict[str, Any],
    *,
    mime_type: str,
) -> str:
    stem = partner_onboarding_file_stem(draft)
    ext = extension_for_mime(mime_type, ".jpg")
    return f"{stem}-profile{ext}"
