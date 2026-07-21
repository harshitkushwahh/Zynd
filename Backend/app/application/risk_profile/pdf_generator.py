"""Branded risk profile PDF report generation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.graphics.shapes import Circle, Drawing, Line, String, Wedge
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PAGE_WIDTH, PAGE_HEIGHT = A4
H_MARGIN = 14 * mm
V_MARGIN = 12 * mm
CONTENT_WIDTH = PAGE_WIDTH - (2 * H_MARGIN)

BRAND_NAVY = colors.HexColor("#0f172a")
BRAND_BLUE = colors.HexColor("#2563eb")
BRAND_BLUE_DARK = colors.HexColor("#1d4ed8")
BRAND_SLATE = colors.HexColor("#475569")
BRAND_MUTED = colors.HexColor("#64748b")
BRAND_BORDER = colors.HexColor("#e2e8f0")
BRAND_SURFACE = colors.HexColor("#f8fafc")

TIER_COLORS = {
    "secure": colors.HexColor("#38bdf8"),
    "conservative": colors.HexColor("#34d399"),
    "moderate": colors.HexColor("#fbbf24"),
    "growth": colors.HexColor("#fb923c"),
    "aggressive": colors.HexColor("#f87171"),
}

TIER_LABELS = {
    "secure": "Secure",
    "conservative": "Conservative",
    "moderate": "Moderate",
    "growth": "Growth",
    "aggressive": "Aggressive",
}


@dataclass(frozen=True)
class RiskProfileReportContext:
    investor_name: str
    investor_email: str
    assessment_id: str
    score: int
    display_score: int
    tier: str
    tier_title: str
    tier_message: str
    completed_at: datetime | None
    questions_answered: int
    total_questions: int
    category_scores: list[tuple[str, float]]
    answers: list[dict[str, Any]]


def _brand_logo_path() -> Path:
    return Path(__file__).resolve().parents[2] / "assets" / "branding" / "hori.png"


def _format_datetime(value: datetime | None) -> str:
    if not value:
        return "—"
    return value.strftime("%d %b %Y, %I:%M %p")


def _truncate(text: str, limit: int) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 1].rstrip()}…"


def _score_gauge_drawing(score: int, tier: str, width: float = 168, height: float = 96) -> Drawing:
    import math

    normalized = max(0, min(100, round(score / 10)))
    tier_color = TIER_COLORS.get(tier.lower(), BRAND_BLUE)
    drawing = Drawing(width, height)

    center_x = width / 2
    center_y = height - 10
    radius = min((width / 2) - 14, height - 22)

    start_angle = 180
    end_angle = 360
    progress_angle = start_angle + (end_angle - start_angle) * (normalized / 100)

    drawing.add(
        Wedge(
            center_x,
            center_y,
            radius,
            start_angle,
            end_angle,
            fillColor=BRAND_BORDER,
            strokeColor=BRAND_BORDER,
            strokeWidth=0,
        )
    )

    if normalized > 0:
        drawing.add(
            Wedge(
                center_x,
                center_y,
                radius,
                start_angle,
                progress_angle,
                fillColor=tier_color,
                strokeColor=tier_color,
                strokeWidth=0,
            )
        )

    angle_rad = math.radians(progress_angle)
    needle_inner = radius * 0.16
    needle_outer = radius * 0.88
    drawing.add(
        Line(
            center_x + needle_inner * math.cos(angle_rad),
            center_y + needle_inner * math.sin(angle_rad),
            center_x + needle_outer * math.cos(angle_rad),
            center_y + needle_outer * math.sin(angle_rad),
            strokeColor=BRAND_NAVY,
            strokeWidth=2,
        )
    )
    drawing.add(Circle(center_x, center_y, 3.5, fillColor=BRAND_NAVY, strokeColor=BRAND_NAVY))

    score_y = center_y - radius * 0.46
    drawing.add(
        String(
            center_x - 6,
            score_y,
            str(normalized),
            fontName="Helvetica-Bold",
            fontSize=18,
            fillColor=BRAND_NAVY,
            textAnchor="end",
        )
    )
    drawing.add(
        String(
            center_x - 2,
            score_y,
            "/100",
            fontName="Helvetica",
            fontSize=9,
            fillColor=BRAND_MUTED,
            textAnchor="start",
        )
    )

    return drawing


def _build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "section": ParagraphStyle(
            "SectionHeading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=BRAND_NAVY,
            spaceBefore=4,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=BRAND_SLATE,
        ),
        "muted": ParagraphStyle(
            "Muted",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9,
            textColor=BRAND_MUTED,
        ),
        "hero_label": ParagraphStyle(
            "HeroLabel",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=BRAND_MUTED,
        ),
        "tier_badge": ParagraphStyle(
            "TierBadge",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.white,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=colors.white,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9,
            textColor=BRAND_SLATE,
            wordWrap="CJK",
        ),
        "table_cell_bold": ParagraphStyle(
            "TableCellBold",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=BRAND_NAVY,
            wordWrap="CJK",
        ),
        "question_title": ParagraphStyle(
            "QuestionTitle",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=BRAND_NAVY,
            spaceAfter=2,
            wordWrap="CJK",
        ),
        "table_cell_muted": ParagraphStyle(
            "TableCellMuted",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7,
            leading=8.5,
            textColor=BRAND_MUTED,
            leftIndent=8,
            wordWrap="CJK",
        ),
        "option_selected": ParagraphStyle(
            "OptionSelected",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=8.5,
            textColor=BRAND_NAVY,
            leftIndent=8,
            wordWrap="CJK",
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7,
            leading=8,
            textColor=BRAND_MUTED,
            alignment=TA_CENTER,
        ),
    }


def _escape_paragraph(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _header_table(logo_path: Path, styles: dict[str, ParagraphStyle]) -> Table:
    logo = Image(str(logo_path), width=36 * mm, height=10 * mm)
    logo.hAlign = "LEFT"
    header_right = Paragraph(
        "<b>Risk Profile Report</b> · "
        "<font color='#64748b'>Investment suitability summary</font>",
        ParagraphStyle(
            "HeaderRight",
            parent=styles["body"],
            alignment=TA_LEFT,
            fontSize=9,
            leading=11,
            textColor=BRAND_NAVY,
        ),
    )
    table = Table([[logo, header_right]], colWidths=[CONTENT_WIDTH * 0.34, CONTENT_WIDTH * 0.66])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BRAND_SURFACE),
                ("BOX", (0, 0), (-1, -1), 0.5, BRAND_BORDER),
                ("LINEBELOW", (0, 0), (-1, 0), 1.5, BRAND_BLUE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def _summary_card(context: RiskProfileReportContext, styles: dict[str, ParagraphStyle]) -> Table:
    tier_color = TIER_COLORS.get(context.tier.lower(), BRAND_BLUE)
    tier_label = TIER_LABELS.get(context.tier.lower(), context.tier.title())

    gauge = _score_gauge_drawing(context.score, context.tier)
    score_block = [gauge, Spacer(1, 1), Paragraph("Risk score", styles["hero_label"])]

    tier_badge = Paragraph(tier_label.upper(), styles["tier_badge"])
    badge_table = Table([[tier_badge]], colWidths=[CONTENT_WIDTH * 0.58])
    badge_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), tier_color),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )

    summary_message = _truncate(context.tier_message, 220)
    meta_line = (
        f"<b>{_escape_paragraph(context.investor_name)}</b> · "
        f"{_format_datetime(context.completed_at)} · "
        f"{context.questions_answered}/{context.total_questions} questions"
    )

    right_block = Table(
        [
            [badge_table],
            [Paragraph(f"<b>{_escape_paragraph(context.tier_title)}</b>", styles["body"])],
            [Paragraph(_escape_paragraph(summary_message), styles["body"])],
            [Paragraph(meta_line, styles["muted"])],
        ],
        colWidths=[CONTENT_WIDTH * 0.58],
    )

    left_width = CONTENT_WIDTH * 0.38
    right_width = CONTENT_WIDTH * 0.62
    card = Table([[score_block, right_block]], colWidths=[left_width, right_width])
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.5, BRAND_BORDER),
                ("LINEBEFORE", (1, 0), (1, -1), 0.5, BRAND_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, -1), 6),
                ("RIGHTPADDING", (0, 0), (0, -1), 4),
                ("LEFTPADDING", (1, 0), (1, -1), 8),
                ("RIGHTPADDING", (1, 0), (1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return card


def _category_table(context: RiskProfileReportContext, styles: dict[str, ParagraphStyle]) -> Table | None:
    if not context.category_scores:
        return None

    col_width = CONTENT_WIDTH / max(len(context.category_scores), 1)
    headers = [
        Paragraph(_escape_paragraph(name), styles["table_header"]) for name, _ in context.category_scores
    ]
    values = [
        Paragraph(f"{max(0, min(100, round(value / 10)))}/100", styles["table_cell_bold"])
        for _, value in context.category_scores
    ]

    table = Table([headers, values], colWidths=[col_width] * len(context.category_scores))
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_NAVY),
                ("BACKGROUND", (0, 1), (-1, 1), BRAND_SURFACE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.25, BRAND_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, BRAND_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def _format_options_paragraphs(
    options: list[dict[str, Any]],
    styles: dict[str, ParagraphStyle],
) -> list[Paragraph]:
    paragraphs: list[Paragraph] = []
    for option in options:
        label = _escape_paragraph(option.get("label") or "")
        if option.get("selected"):
            paragraphs.append(Paragraph(f"● {label}", styles["option_selected"]))
        else:
            paragraphs.append(Paragraph(f"○ {label}", styles["table_cell_muted"]))
    return paragraphs


def _answer_card(
    item: dict[str, Any],
    index: int,
    total: int,
    styles: dict[str, ParagraphStyle],
) -> Table:
    category = item.get("category_name") or "General"
    prompt = item.get("prompt") or ""
    options = item.get("options") or []
    if not options and item.get("selected_option_label"):
        options = [{"label": item.get("selected_option_label"), "selected": True}]

    header = (
        f"<font color='#64748b'>Question {index} of {total} · "
        f"{_escape_paragraph(category)}</font>"
    )
    body_rows: list[list[Any]] = [
        [Paragraph(header, styles["table_cell"])],
        [Paragraph(_escape_paragraph(prompt), styles["question_title"])],
    ]

    for option_paragraph in _format_options_paragraphs(options, styles):
        body_rows.append([option_paragraph])

    card = Table(body_rows, colWidths=[CONTENT_WIDTH * 0.48])
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.25, BRAND_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return card


def _answers_section(context: RiskProfileReportContext, styles: dict[str, ParagraphStyle]) -> Table:
    total = len(context.answers)
    cards = [
        _answer_card(item, index, total, styles)
        for index, item in enumerate(context.answers, start=1)
    ]

    rows: list[list[Any]] = []
    for index in range(0, len(cards), 2):
        left = cards[index]
        right = cards[index + 1] if index + 1 < len(cards) else ""
        rows.append([left, right])

    col_width = CONTENT_WIDTH * 0.49
    table = Table(rows, colWidths=[col_width, col_width], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def generate_risk_profile_report_pdf(context: RiskProfileReportContext) -> bytes:
    logo_path = _brand_logo_path()
    if not logo_path.is_file():
        raise FileNotFoundError(f"Brand logo not found at {logo_path}")

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=H_MARGIN,
        rightMargin=H_MARGIN,
        topMargin=V_MARGIN,
        bottomMargin=V_MARGIN,
        title="Zynd Risk Profile Report",
        author="Zynd",
    )
    styles = _build_styles()
    story: list[Any] = [
        _header_table(logo_path, styles),
        Spacer(1, 6),
        _summary_card(context, styles),
    ]

    category_table = _category_table(context, styles)
    if category_table:
        story.extend([Spacer(1, 6), Paragraph("Category scores", styles["section"]), category_table])

    story.extend(
        [
            Spacer(1, 6),
            Paragraph("Your answers", styles["section"]),
            Paragraph(
                "<font color='#64748b'>Responses from your completed assessment.</font>",
                styles["muted"],
            ),
            Spacer(1, 4),
            _answers_section(context, styles),
            Spacer(1, 6),
            Paragraph(
                "This report reflects your self-reported risk profile at the time of assessment. "
                "It is for information only and does not constitute investment advice.",
                styles["muted"],
            ),
            Spacer(1, 4),
            Paragraph(
                f"Generated by Zynd · {_escape_paragraph(context.investor_email)} · "
                f"Report {context.assessment_id[:8].upper()} · {_format_datetime(context.completed_at)}",
                styles["footer"],
            ),
        ]
    )

    doc.build(story)
    return buffer.getvalue()
