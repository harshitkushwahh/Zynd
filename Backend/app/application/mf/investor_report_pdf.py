"""Shared A4 core PDF for investor statements (not the risk-profile branded layout)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Literal, Sequence

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PAGE_WIDTH, PAGE_HEIGHT = A4
PAGE_MARGIN = 18 * mm
HEADER_BAND = 12 * mm
FOOTER_BAND = 22 * mm
CONTENT_INSET = PAGE_MARGIN + HEADER_BAND
FOOTER_INSET = PAGE_MARGIN + FOOTER_BAND
CONTENT_WIDTH = PAGE_WIDTH - (2 * PAGE_MARGIN)

AMFI_DISCLAIMER = (
    "Mutual fund investments are subject to market risks, read all scheme-related documents carefully. "
    "Past performance is not indicative of future returns."
)
STATEMENT_DISCLAIMER = (
    "This is a Zynd-generated statement from registrar / Cybrilla data for the period shown. "
    "It is not an AMC or CAMS/KFin CAS, not a tax certificate, and not investment advice. "
    "NAVs, units, and gains can change after the as-on date. Verify figures with the AMC before filing taxes or redeeming."
)

INK = colors.HexColor("#18181b")
MUTED = colors.HexColor("#52525b")
RULE = colors.HexColor("#e4e4e7")
HEADER_FILL = colors.HexColor("#f4f4f5")

ColumnAlign = Literal["left", "right"]


@dataclass(frozen=True)
class ReportColumn:
    key: str
    label: str
    width: float
    align: ColumnAlign = "left"


@dataclass(frozen=True)
class ReportSection:
    heading: str
    columns: Sequence[ReportColumn]
    rows: Sequence[dict[str, Any]]
    totals: dict[str, Any] | None = None
    empty_message: str = "No records for this period."


@dataclass(frozen=True)
class InvestorReportDocument:
    title: str
    period_label: str
    investor_name: str
    masked_pan: str | None
    generated_at: datetime
    zynd_id: str | None = None
    email: str | None = None
    mobile: str | None = None
    sections: Sequence[ReportSection] = field(default_factory=tuple)


def _brand_logo_path() -> Path:
    return Path(__file__).resolve().parents[2] / "assets" / "branding" / "hori.png"


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "InvestorReportTitle",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=INK,
            spaceAfter=2,
            alignment=TA_LEFT,
        ),
        "meta": ParagraphStyle(
            "InvestorReportMeta",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=MUTED,
        ),
        "section": ParagraphStyle(
            "InvestorReportSection",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=INK,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "cell": ParagraphStyle(
            "InvestorReportCell",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=INK,
        ),
        "cell_right": ParagraphStyle(
            "InvestorReportCellRight",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=INK,
            alignment=TA_RIGHT,
        ),
        "th": ParagraphStyle(
            "InvestorReportTh",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=INK,
        ),
        "th_right": ParagraphStyle(
            "InvestorReportThRight",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=INK,
            alignment=TA_RIGHT,
        ),
        "empty": ParagraphStyle(
            "InvestorReportEmpty",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=MUTED,
        ),
        "chrome": ParagraphStyle(
            "InvestorReportChrome",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=MUTED,
        ),
        "chrome_right": ParagraphStyle(
            "InvestorReportChromeRight",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=MUTED,
            alignment=TA_RIGHT,
        ),
        "chrome_brand": ParagraphStyle(
            "InvestorReportBrand",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=INK,
        ),
        "identity_label": ParagraphStyle(
            "InvestorReportIdentityLabel",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            textColor=MUTED,
        ),
        "identity_value": ParagraphStyle(
            "InvestorReportIdentityValue",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=INK,
        ),
    }


def _format_generated_at(value: datetime) -> str:
    return value.strftime("%d %b %Y, %H:%M UTC")


def _cell(text: Any, *, right: bool, styles: dict[str, ParagraphStyle]) -> Paragraph:
    raw = "—" if text is None or text == "" else str(text)
    escaped = raw.replace("&", "&amp;").replace("<", "&lt;").replace("\n", "<br/>")
    return Paragraph(escaped, styles["cell_right" if right else "cell"])


def _wrap_text(text: str, *, font: str, size: float, width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if stringWidth(trial, font, size) <= width:
            current = trial
            continue
        if current:
            lines.append(current)
        current = word
    if current:
        lines.append(current)
    return lines


class NumberedCanvas(pdf_canvas.Canvas):
    def __init__(self, *args, report_title: str = "", generated_label: str = "", **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict[str, Any]] = []
        self._report_title = report_title
        self._generated_label = generated_label

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        page_count = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_chrome(page_count)
            super().showPage()
        super().save()

    def _draw_chrome(self, page_count: int) -> None:
        header_y = PAGE_HEIGHT - PAGE_MARGIN - 8
        footer_y = PAGE_MARGIN
        logo_path = _brand_logo_path()
        if logo_path.is_file():
            self.drawImage(
                str(logo_path),
                PAGE_MARGIN,
                header_y - 2,
                width=28 * mm,
                height=7 * mm,
                preserveAspectRatio=True,
                mask="auto",
                anchor="sw",
            )
        else:
            self.setFont("Helvetica-Bold", 9)
            self.setFillColor(INK)
            self.drawString(PAGE_MARGIN, header_y, "Zynd")
        self.setStrokeColor(RULE)
        self.setLineWidth(0.4)
        self.line(PAGE_MARGIN, header_y - 4, PAGE_WIDTH - PAGE_MARGIN, header_y - 4)

        wrap_width = CONTENT_WIDTH - (28 * mm)
        lines = _wrap_text(f"{AMFI_DISCLAIMER} {STATEMENT_DISCLAIMER}", font="Helvetica", size=6, width=wrap_width)
        line_height = 8
        text_top = footer_y + FOOTER_BAND - 2
        self.line(PAGE_MARGIN, text_top + 4, PAGE_WIDTH - PAGE_MARGIN, text_top + 4)
        self.setFont("Helvetica", 6)
        self.setFillColor(MUTED)
        for index, line in enumerate(lines[:5]):
            self.drawString(PAGE_MARGIN, text_top - (index * line_height), line)
        self.setFont("Helvetica", 7)
        self.drawString(PAGE_MARGIN, footer_y, self._generated_label)
        self.drawRightString(
            PAGE_WIDTH - PAGE_MARGIN,
            footer_y,
            f"Page {self._pageNumber} of {page_count}",
        )


def _identity_pairs(document: InvestorReportDocument) -> list[tuple[str, str]]:
    return [
        ("Investor", document.investor_name or "—"),
        ("PAN", document.masked_pan or "—"),
        ("Zynd ID", document.zynd_id or "—"),
        ("Email", document.email or "—"),
        ("Mobile", document.mobile or "—"),
        ("Period", document.period_label or "—"),
    ]


def _title_block(document: InvestorReportDocument, styles: dict[str, ParagraphStyle]) -> list[Any]:
    pairs = _identity_pairs(document)
    cells: list[Any] = []
    for label, value in pairs:
        cells.append(
            [
                Paragraph(label, styles["identity_label"]),
                Paragraph(str(value).replace("&", "&amp;").replace("<", "&lt;"), styles["identity_value"]),
            ]
        )
    grid = Table(
        [
            [cells[0], cells[1], cells[2]],
            [cells[3], cells[4], cells[5]],
        ],
        colWidths=[CONTENT_WIDTH / 3] * 3,
        hAlign="LEFT",
    )
    grid.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return [
        Paragraph(document.title, styles["title"]),
        Spacer(1, 8),
        grid,
        Spacer(1, 6),
    ]


def _section_table(section: ReportSection, styles: dict[str, ParagraphStyle]) -> Table:
    col_widths = [column.width * CONTENT_WIDTH for column in section.columns]
    header = [
        Paragraph(column.label, styles["th_right" if column.align == "right" else "th"])
        for column in section.columns
    ]
    data: list[list[Any]] = [header]

    if not section.rows:
        empty = Paragraph(section.empty_message, styles["empty"])
        data.append([empty] + [""] * (len(section.columns) - 1))
    else:
        for row in section.rows:
            data.append(
                [
                    _cell(row.get(column.key), right=column.align == "right", styles=styles)
                    for column in section.columns
                ]
            )
        if section.totals:
            data.append(
                [
                    _cell(section.totals.get(column.key), right=column.align == "right", styles=styles)
                    for column in section.columns
                ]
            )

    table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    style_commands: list[tuple] = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_FILL),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, RULE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if not section.rows:
        style_commands.append(("SPAN", (0, 1), (-1, 1)))
    if section.totals and section.rows:
        style_commands.append(("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"))
    table.setStyle(TableStyle(style_commands))
    return table


def document_page_metrics() -> dict[str, float]:
    return {
        "page_width": PAGE_WIDTH,
        "page_height": PAGE_HEIGHT,
        "left_margin": PAGE_MARGIN,
        "right_margin": PAGE_MARGIN,
        "top_margin": CONTENT_INSET,
        "bottom_margin": FOOTER_INSET,
        "edge_margin": PAGE_MARGIN,
    }


def generate_investor_report_pdf(document: InvestorReportDocument) -> bytes:
    buffer = BytesIO()
    styles = _styles()
    generated_label = _format_generated_at(document.generated_at)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=PAGE_MARGIN,
        rightMargin=PAGE_MARGIN,
        topMargin=CONTENT_INSET,
        bottomMargin=FOOTER_INSET,
        title=document.title,
        author="Zynd",
    )

    story: list[Any] = _title_block(document, styles)
    for section in document.sections:
        story.append(
            KeepTogether(
                [
                    Paragraph(section.heading, styles["section"]),
                    _section_table(section, styles),
                ]
            )
        )

    doc.build(
        story,
        canvasmaker=lambda *args, **kwargs: NumberedCanvas(
            *args,
            report_title=document.title,
            generated_label=generated_label,
            **{**kwargs, "pageCompression": 0},
        ),
    )
    return buffer.getvalue()
