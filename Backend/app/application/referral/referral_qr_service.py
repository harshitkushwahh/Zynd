"""Branded referral QR code PNG generation."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw
from qrcode.constants import ERROR_CORRECT_H
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import SolidFillColorMask
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer, SquareModuleDrawer

COLOR_BG = (255, 255, 255)
COLOR_BLACK = (0, 0, 0)
COLOR_EMERALD = (16, 185, 129)  # --zynd-emerald

FINDER_MODULES = 7
FINDER_CENTER_START = 2
FINDER_CENTER_MODULES = 3

QUIET_ZONE_MODULES = 4
EMBEDDED_LOGO_RATIO = 0.22
LOGO_BADGE_PADDING_RATIO = 0.12
FINDER_CENTER_CORNER_RATIO = 0.15
REFERRAL_QR_TEMPLATE_VERSION = 5


def _branding_logo_path() -> Path:
    return Path(__file__).resolve().parents[2] / "assets" / "branding" / "logo.png"


def _finder_origins(data_width: int, border: int) -> tuple[tuple[int, int], ...]:
    """Matrix indices for the three finder patterns (includes quiet-zone border)."""
    return (
        (border, border),
        (border, border + data_width - FINDER_MODULES),
        (border + data_width - FINDER_MODULES, border),
    )


def _apply_emerald_finder_centers(
    image: Image.Image,
    *,
    data_width: int,
    box_size: int,
    border: int,
) -> None:
    draw = ImageDraw.Draw(image)

    for row_origin, col_origin in _finder_origins(data_width, border):
        x0 = (col_origin + FINDER_CENTER_START) * box_size
        y0 = (row_origin + FINDER_CENTER_START) * box_size
        size = FINDER_CENTER_MODULES * box_size
        corner_radius = max(2, int(size * FINDER_CENTER_CORNER_RATIO))
        draw.rounded_rectangle(
            [x0, y0, x0 + size - 1, y0 + size - 1],
            radius=corner_radius,
            fill=COLOR_EMERALD,
        )


def _build_embedded_logo_badge(logo_path: Path, *, canvas_size: int) -> Image.Image:
    logo = Image.open(logo_path).convert("RGBA")
    badge_size = max(1, int(canvas_size * EMBEDDED_LOGO_RATIO))
    pad = max(6, int(badge_size * LOGO_BADGE_PADDING_RATIO))
    logo_size = max(1, badge_size - pad * 2)
    logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)

    badge = Image.new("RGBA", (badge_size, badge_size), (0, 0, 0, 0))
    badge_draw = ImageDraw.Draw(badge)
    badge_draw.rounded_rectangle(
        [0, 0, badge_size - 1, badge_size - 1],
        radius=max(8, int(badge_size * 0.16)),
        fill=(*COLOR_BG, 255),
    )
    badge.alpha_composite(logo, (pad, pad))
    return badge


def generate_referral_qr_png(data: str, *, size: int = 512, logo_path: Path | None = None) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        border=QUIET_ZONE_MODULES,
    )
    qr.add_data(data)
    qr.make(fit=True)

    data_width = len(qr.get_matrix()) - (2 * QUIET_ZONE_MODULES)
    box_size = max(4, size // (data_width + 2 * QUIET_ZONE_MODULES))

    qr = qrcode.QRCode(
        version=qr.version,
        error_correction=ERROR_CORRECT_H,
        box_size=box_size,
        border=QUIET_ZONE_MODULES,
    )
    qr.add_data(data)
    qr.make(fit=True)

    resolved_logo = logo_path or _branding_logo_path()
    embedded_logo = _build_embedded_logo_badge(resolved_logo, canvas_size=size) if resolved_logo.is_file() else None

    styled_image = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
        eye_drawer=SquareModuleDrawer(),
        color_mask=SolidFillColorMask(back_color=COLOR_BG, front_color=COLOR_BLACK),
        embedded_image=embedded_logo,
        embedded_image_ratio=EMBEDDED_LOGO_RATIO,
    )
    image = styled_image.get_image().convert("RGB")

    _apply_emerald_finder_centers(
        image,
        data_width=styled_image.width,
        box_size=styled_image.box_size,
        border=styled_image.border,
    )

    if image.size[0] != size:
        image = image.resize((size, size), Image.Resampling.LANCZOS)

    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
