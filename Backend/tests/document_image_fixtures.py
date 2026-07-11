from __future__ import annotations

from io import BytesIO


def profile_image_png_bytes(width: int = 256, height: int = 256) -> bytes:
    from PIL import Image

    image = Image.new("RGB", (width, height), color=(90, 120, 180))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
