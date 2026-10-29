"""Customer support chat input bounds (text + image uploads)."""

from __future__ import annotations

from app.application.support.ticket_service import SupportActionError

SUPPORT_CUSTOMER_MESSAGE_MAX_CHARS = 4000
SUPPORT_CUSTOMER_MESSAGE_MIN_CHARS = 1

SUPPORT_TICKET_IMAGE_MAX_BYTES = 5 * 1024 * 1024
SUPPORT_TICKET_IMAGE_MIN_BYTES = 1

# Backward-compatible alias for ticket attachment storage.
MAX_TICKET_IMAGE_BYTES = SUPPORT_TICKET_IMAGE_MAX_BYTES


def sniff_image_mime(content: bytes) -> str | None:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def normalize_customer_message_body(body: str) -> str:
    return (body or "").strip()


def validate_customer_message_text(*, text: str, has_attachment: bool) -> str:
    """Return normalized body or raise SupportActionError."""
    normalized = normalize_customer_message_body(text)
    if len(normalized) > SUPPORT_CUSTOMER_MESSAGE_MAX_CHARS:
        raise SupportActionError(
            "message_too_long",
            f"Message must be {SUPPORT_CUSTOMER_MESSAGE_MAX_CHARS} characters or fewer.",
        )
    if has_attachment and not normalized:
        return "I attached an image."
    if len(normalized) < SUPPORT_CUSTOMER_MESSAGE_MIN_CHARS:
        raise SupportActionError("empty_message", "Write a message before sending.")
    return normalized


def validate_customer_image_bytes(*, filename: str, content: bytes) -> None:
    if len(content) < SUPPORT_TICKET_IMAGE_MIN_BYTES:
        raise SupportActionError("empty_file", "Uploaded file is empty.")
    if len(content) > SUPPORT_TICKET_IMAGE_MAX_BYTES:
        raise SupportActionError(
            "file_too_large",
            "Image must be 5 MB or smaller.",
            413,
        )
    mime_type = sniff_image_mime(content)
    if mime_type is None:
        raise SupportActionError("invalid_image", "Upload a PNG, JPG, or WebP image.")


__all__ = [
    "MAX_TICKET_IMAGE_BYTES",
    "SUPPORT_CUSTOMER_MESSAGE_MAX_CHARS",
    "SUPPORT_CUSTOMER_MESSAGE_MIN_CHARS",
    "SUPPORT_TICKET_IMAGE_MAX_BYTES",
    "SUPPORT_TICKET_IMAGE_MIN_BYTES",
    "normalize_customer_message_body",
    "sniff_image_mime",
    "validate_customer_image_bytes",
    "validate_customer_message_text",
]
