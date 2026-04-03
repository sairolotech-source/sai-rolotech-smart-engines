"""
pdf_export_engine.py — PDF Export Engine
Converts report_engine output into a downloadable PDF using ReportLab.
"""
import os
import uuid
import logging
from typing import Any, Dict, List

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.platypus import HRFlowable

logger = logging.getLogger("pdf_export_engine")

EXPORT_DIR = "exports"


def ensure_export_dir():
    os.makedirs(EXPORT_DIR, exist_ok=True)


def safe(value: Any, suffix: str = "") -> str:
    if value is None or value == "N/A":
        return "N/A"
    return f"{value}{suffix}"


def build_summary_table(summary: Dict[str, Any]) -> Table:
    data = [
        ["Field", "Value"],
        ["Profile Type", safe(summary.get("profile_type"))],
        ["Section Width", safe(summary.get("section_width_mm"), " mm")],
        ["Section Height", safe(summary.get("section_height_mm"), " mm")],
        ["Bend Count", safe(summary.get("bend_count"))],
        ["Return Bends", safe(summary.get("return_bends_count"))],
        ["Material", safe(summary.get("material"))],
        ["Sheet Thickness", safe(summary.get("sheet_thickness_mm"), " mm")],
        ["Forming Complexity", safe(summary.get("forming_complexity_class"))],
        ["Complexity Score", safe(summary.get("complexity_score"))],
        ["Est. Forming Passes", safe(summary.get("estimated_forming_passes"))],
        ["Recommended Stations", safe(summary.get("recommended_station_count"))],
        ["Shaft Diameter", safe(summary.get("shaft_diameter_mm"), " mm")],
        ["Bearing Type", safe(summary.get("bearing_type"))],
        ["Machine Duty Class", safe(summary.get("machine_duty_class"))],
        ["Est. Roll OD", safe(summary.get("estimated_roll_od_mm"), " mm")],
        ["Est. Vertical Gap", safe(summary.get("estimated_vertical_gap_mm"), " mm")],
        ["Est. Side Clearance", safe(summary.get("estimated_side_clearance_mm"), " mm")],
        ["Est. Line Length", safe(summary.get("estimated_line_length_mm"), " mm")],
    ]

    col_widths = [80 * mm, 80 * mm]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3a5c")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f5f8fc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f5f8fc"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c0c0c0")),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def build_pass_gap_table(pass_plan: List[Dict[str, Any]]) -> Table:
    data = [["Station", "Stage Type", "Target Gap (mm)"]]
    for p in pass_plan:
        data.append([
            str(p.get("station_no", "")),
            str(p.get("stage_type", "")),
            str(p.get("target_gap_mm", "")),
        ])

    col_widths = [30 * mm, 100 * mm, 40 * mm]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3a5c")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f5f8fc"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c0c0c0")),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def export_report_pdf(
    report_result: Dict[str, Any],
    file_prefix: str = "roll_forming_report",
) -> Dict[str, Any]:
    if not report_result or report_result.get("status") != "pass":
        return {
            "engine": "pdf_export_engine",
            "status": "fail",
            "reason": "Report result missing or failed",
        }

    ensure_export_dir()

    file_id = str(uuid.uuid4())[:8]
    filename = f"{file_prefix}_{file_id}.pdf"
    file_path = os.path.join(EXPORT_DIR, filename)

    summary = report_result.get("engineering_summary", {})
    readable = report_result.get("readable_report", "")
    pass_plan = []

    try:
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=colors.HexColor("#1a3a5c"),
            spaceAfter=4,
            fontName="Helvetica-Bold",
        )
        sub_style = ParagraphStyle(
            "SubTitle",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#b03030"),
            spaceAfter=10,
            fontName="Helvetica-Bold",
        )
        section_style = ParagraphStyle(
            "SectionHead",
            parent=styles["Heading2"],
            fontSize=11,
            textColor=colors.HexColor("#1a3a5c"),
            spaceAfter=4,
            spaceBefore=12,
            fontName="Helvetica-Bold",
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            spaceAfter=2,
        )
        mono_style = ParagraphStyle(
            "Mono",
            parent=styles["Code"],
            fontSize=7.5,
            leading=11,
            spaceAfter=1,
            fontName="Courier",
            leftIndent=6,
        )
        warning_style = ParagraphStyle(
            "Warning",
            parent=styles["Normal"],
            fontSize=8.5,
            textColor=colors.HexColor("#b03030"),
            leftIndent=8,
            spaceAfter=2,
        )
        disclaimer_style = ParagraphStyle(
            "Disclaimer",
            parent=styles["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#555555"),
            leading=12,
            spaceAfter=2,
        )

        doc = SimpleDocTemplate(
            file_path,
            pagesize=A4,
            leftMargin=20 * mm,
            rightMargin=20 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title="Roll Forming Preliminary Engineering Report",
            author="Sai Rolotech Smart Engines v2.2.0",
        )

        story = []

        story.append(Paragraph("SAI ROLOTECH SMART ENGINES v2.2.0", title_style))
        story.append(Paragraph("Roll Forming Preliminary Engineering Report", styles["Heading2"]))
        story.append(Paragraph(
            "FOR ENGINEERING REFERENCE ONLY — NOT A FINAL APPROVED TOOLING DOCUMENT",
            sub_style,
        ))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1a3a5c")))
        story.append(Spacer(1, 6 * mm))

        story.append(Paragraph("Engineering Summary", section_style))
        story.append(build_summary_table(summary))
        story.append(Spacer(1, 6 * mm))

        roll_calc_warnings = []
        if readable:
            in_pass_section = False
            in_warnings = False

            for line in readable.splitlines():
                stripped = line.strip()

                if "SECTION 8: PASS GAP PLAN" in stripped:
                    in_pass_section = True
                    continue
                if in_pass_section and stripped.startswith("SECTION 9"):
                    in_pass_section = False

                if "SECTION 7:" in stripped and "ROLL DESIGN" in stripped:
                    in_warnings = True
                if in_warnings and stripped.startswith("Roll Warnings:"):
                    in_warnings = True
                if in_warnings and stripped.startswith("- ") and not stripped.startswith("- SAI"):
                    roll_calc_warnings.append(stripped[2:])
                if in_warnings and stripped.startswith("SECTION 8"):
                    in_warnings = False

        roll_calc_part = report_result.get("_raw_roll_calc", {})
        if not pass_plan and summary:
            pass

        story.append(Paragraph("Pass Gap Plan (Station-by-Station)", section_style))

        if readable:
            plan_lines = []
            in_plan = False
            for line in readable.splitlines():
                if "SECTION 8: PASS GAP PLAN" in line:
                    in_plan = True
                    continue
                if in_plan and line.strip().startswith("SECTION 9"):
                    break
                if in_plan and line.strip() and not line.strip().startswith("-" * 5):
                    plan_lines.append(line)

            if len(plan_lines) > 2:
                table_data = [["Station", "Stage Type", "Gap (mm)"]]
                for pl in plan_lines[2:]:
                    parts = pl.strip().split()
                    if len(parts) >= 3 and parts[0].isdigit():
                        stage = " ".join(parts[1:-1])
                        gap = parts[-1]
                        table_data.append([parts[0], stage, gap])
                if len(table_data) > 1:
                    col_widths = [30 * mm, 100 * mm, 40 * mm]
                    t = Table(table_data, colWidths=col_widths)
                    t.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3a5c")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 9),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f5f8fc"), colors.white]),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c0c0c0")),
                        ("ALIGN", (0, 0), (0, -1), "CENTER"),
                        ("ALIGN", (2, 0), (2, -1), "CENTER"),
                        ("FONTSIZE", (0, 1), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]))
                    story.append(t)
                else:
                    story.append(Paragraph("No pass gap data available.", body_style))
            else:
                story.append(Paragraph("No pass gap data available.", body_style))
        story.append(Spacer(1, 5 * mm))

        if readable:
            story.append(Paragraph("Full Detailed Report", section_style))
            for line in readable.splitlines():
                stripped = line.strip()
                if not stripped:
                    story.append(Spacer(1, 1.5 * mm))
                elif stripped.startswith("=") or stripped.startswith("-"):
                    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aaaaaa")))
                elif stripped.startswith("SECTION"):
                    story.append(Paragraph(stripped, section_style))
                elif stripped.startswith("- ") and "WARNING" in stripped.upper() or ("may require" in stripped or "springback" in stripped or "Return bends" in stripped or "Shutter-like" in stripped or "Roll OD" in stripped):
                    story.append(Paragraph(f"⚠ {stripped[2:]}", warning_style))
                elif stripped.startswith("THIS IS A PRELIMINARY") or "must be verified" in stripped or "Final tooling" in stripped or "before manufacture" in stripped or "All dimensions" in stripped:
                    story.append(Paragraph(stripped, disclaimer_style))
                elif stripped.startswith("GENERATED BY"):
                    story.append(Paragraph(stripped, sub_style))
                elif stripped.startswith("SAI ROLOTECH"):
                    pass
                else:
                    story.append(Paragraph(stripped, mono_style))

        doc.build(story)

        logger.info("[pdf_export_engine] saved %s", file_path)

        return {
            "engine": "pdf_export_engine",
            "status": "pass",
            "file_path": file_path,
            "filename": filename,
            "notes": [
                "PDF export created successfully",
                "This is a preliminary engineering report — not a final approved tooling document",
            ],
        }

    except Exception as e:
        logger.exception("[pdf_export_engine] export failed")
        return {
            "engine": "pdf_export_engine",
            "status": "fail",
            "reason": f"PDF export failed: {str(e)}",
        }
