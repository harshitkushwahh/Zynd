import pytest

from app.application.support.customer_message_limits import (
    SUPPORT_CUSTOMER_MESSAGE_MAX_CHARS,
    validate_customer_image_bytes,
    validate_customer_message_text,
)
from app.application.support.ticket_service import SupportActionError


def test_validate_message_empty_without_attachment():
    with pytest.raises(SupportActionError) as exc:
        validate_customer_message_text(text="   ", has_attachment=False)
    assert exc.value.code == "empty_message"


def test_validate_message_image_only_default_caption():
    assert (
        validate_customer_message_text(text="", has_attachment=True)
        == "I attached an image."
    )


def test_validate_message_too_long():
    text = "a" * (SUPPORT_CUSTOMER_MESSAGE_MAX_CHARS + 1)
    with pytest.raises(SupportActionError) as exc:
        validate_customer_message_text(text=text, has_attachment=False)
    assert exc.value.code == "message_too_long"


def test_validate_image_empty():
    with pytest.raises(SupportActionError) as exc:
        validate_customer_image_bytes(filename="x.png", content=b"")
    assert exc.value.code == "empty_file"


def test_validate_image_invalid_type():
    with pytest.raises(SupportActionError) as exc:
        validate_customer_image_bytes(filename="x.png", content=b"not-an-image")
    assert exc.value.code == "invalid_image"


def test_validate_image_accepts_minimal_png():
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
    validate_customer_image_bytes(filename="shot.png", content=png)
