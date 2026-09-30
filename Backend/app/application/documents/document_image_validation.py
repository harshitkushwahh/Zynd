from __future__ import annotations

from io import BytesIO

from app.application.documents.errors import DocumentError
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import DocumentType

_PROFILE_IMAGE_MIMES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
    }
)

_IMAGE_MIMES = _PROFILE_IMAGE_MIMES | frozenset({"image/png", "image/jpeg", "image/webp"})


def is_profile_image_mime(mime_type: str) -> bool:
    return mime_type in _PROFILE_IMAGE_MIMES


def max_bytes_for_doc_type(doc_type: DocumentType, settings: Settings | None = None) -> int:
    settings = settings or get_settings()
    if doc_type in {DocumentType.profile_image, DocumentType.family_group_avatar}:
        return settings.documents_profile_image_max_bytes
    return settings.documents_max_bytes


def validate_profile_image_content(
    content: bytes,
    *,
    settings: Settings | None = None,
) -> tuple[bytes, str]:
    settings = settings or get_settings()

    try:
        from PIL import Image
    except ImportError as exc:  # pragma: no cover
        raise DocumentError(
            "Image processing is unavailable.",
            "image_processing_unavailable",
            503,
        ) from exc

    try:
        with Image.open(BytesIO(content)) as image:
            image.load()
            width, height = image.size
    except Exception as exc:
        raise DocumentError(
            "Invalid or corrupted image file.",
            "invalid_image",
            400,
        ) from exc

    min_dim = settings.documents_profile_image_min_dimension
    max_dim = settings.documents_profile_image_max_dimension
    if width < min_dim or height < min_dim:
        raise DocumentError(
            f"Image must be at least {min_dim}x{min_dim} pixels.",
            "image_too_small",
            400,
        )

    try:
        with Image.open(BytesIO(content)) as image:
            image.load()
            if image.mode not in {"RGB", "L"}:
                image = image.convert("RGB")
            else:
                image = image.copy()

            if max(width, height) > max_dim:
                image.thumbnail((max_dim, max_dim))

            max_output_bytes = settings.documents_profile_image_max_bytes
            if settings.clamav_enabled:
                max_output_bytes = min(
                    max_output_bytes,
                    settings.clamav_stream_max_length_bytes,
                )

            normalized = _encode_jpeg_within_limit(image, max_bytes=max_output_bytes)
    except DocumentError:
        raise
    except Exception as exc:
        raise DocumentError(
            "Could not process image file.",
            "invalid_image",
            400,
        ) from exc

    return normalized, "image/jpeg"


def _encode_jpeg_within_limit(image, *, max_bytes: int) -> bytes:
    for quality in (88, 82, 76, 70, 64, 58, 52, 46):
        output = BytesIO()
        image.save(output, format="JPEG", quality=quality, optimize=True)
        normalized = output.getvalue()
        if len(normalized) <= max_bytes:
            return normalized

    raise DocumentError(
        "Processed image is too large.",
        "file_too_large",
        413,
    )


def should_normalize_profile_image(doc_type: DocumentType) -> bool:
    return doc_type == DocumentType.profile_image
